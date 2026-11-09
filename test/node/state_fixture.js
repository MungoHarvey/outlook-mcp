/**
 * test/node/state_fixture.js
 *
 * Fixture builder for state directory lookup tests.
 * Creates isolated temporary plugin trees and home directories for testing
 * the auth-server.js state resolution logic without touching real credentials.
 *
 * Usage:
 *   const { buildFixture, runWhere, getExpectedPaths } = require('./state_fixture');
 *   const fixture = buildFixture(scenario);
 *   const result = runWhere(fixture.pluginDir, fixture.env);
 *   fixture.cleanup();
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// Allowlist of files to copy from the repo into the fixture plugin tree.
// Never copy the whole checkout — we want a minimal, controlled environment.
const ALLOWLIST = [
  'outlook-skills/auth-server.js',
  'outlook-skills/scopes.json',
  'outlook-skills/.env.example',
  'outlook-skills/auth.sh',
  'outlook-skills/auth.ps1',
];

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Assert the plugin directory has no .env or tokens.json files.
 * @param {string} pluginDir - Path to the plugin directory
 */
function assertNoAuthState(pluginDir) {
  const envFile = path.join(pluginDir, '.env');
  const tokensFile = path.join(pluginDir, 'tokens.json');
  if (fs.existsSync(envFile)) {
    throw new Error(
      `Fixture plugin tree already contains .env at ${envFile}. ` +
      'Refusing to run tests with real credentials present.'
    );
  }
  if (fs.existsSync(tokensFile)) {
    throw new Error(
      `Fixture plugin tree already contains tokens.json at ${tokensFile}. ` +
      'Refusing to run tests with real credentials present.'
    );
  }
}

/**
 * Build a temporary fixture for a single scenario.
 *
 * @param {Object} scenario - A row from state-dir-scenarios.json
 * @returns {Object} Fixture with pluginDir, homeDir, env, cleanup
 */
function buildFixture(scenario) {
  // Create temp directories
  const pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlook-fixture-plugin-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlook-fixture-home-'));

  let overrideDir = null;

  const cleanup = () => {
    try { fs.rmSync(pluginDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(homeDir, { recursive: true, force: true }); } catch {}
    if (overrideDir) {
      try { fs.rmSync(overrideDir, { recursive: true, force: true }); } catch {}
    }
  };

  try {
    // Copy allowlisted files only
    for (const relPath of ALLOWLIST) {
      const src = path.join(REPO_ROOT, relPath);
      if (!fs.existsSync(src)) {
        throw new Error(`Allowlisted file not found: ${src}`);
      }
      const dst = path.join(pluginDir, relPath);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }

    // Assert no auth state in the fixture before adding synthetic files
    const outlookSkillsDir = path.join(pluginDir, 'outlook-skills');
    assertNoAuthState(outlookSkillsDir);

    // Create synthetic state files in home/.outlook-skills and/or plugin
    const homeFiles = scenario.home || [];
    const pluginFiles = scenario.plugin || [];

    // State files go under ~/.outlook-skills, not directly in home
    const homeStateDir = path.join(homeDir, '.outlook-skills');
    fs.mkdirSync(homeStateDir, { recursive: true });

    const fakeEnvContent =
      'OUTLOOK_CLIENT_ID=fake-client-id-for-tests\n' +
      'OUTLOOK_CLIENT_SECRET=fake-secret-for-tests\n';

    const fakeTokensContent = JSON.stringify({
      access_token: 'fake-access-token-for-tests',
      refresh_token: 'fake-refresh-token-for-tests',
      client_id: 'fake-client-id-for-tests',
      client_secret: 'fake-secret-for-tests',
      session_started_at: 0,
      access_token_expires_at: 9999999999,
    }, null, 2);

    for (const fname of homeFiles) {
      const fpath = path.join(homeStateDir, fname);
      if (fname === '.env') {
        fs.writeFileSync(fpath, fakeEnvContent);
      } else if (fname === 'tokens.json') {
        fs.writeFileSync(fpath, fakeTokensContent);
      }
    }

    for (const fname of pluginFiles) {
      const fpath = path.join(outlookSkillsDir, fname);
      if (fname === '.env') {
        fs.writeFileSync(fpath,
          'OUTLOOK_CLIENT_ID=fake-plugin-client-id\n' +
          'OUTLOOK_CLIENT_SECRET=fake-plugin-secret\n'
        );
      } else if (fname === 'tokens.json') {
        fs.writeFileSync(fpath, JSON.stringify({
          access_token: 'fake-plugin-access-token',
          refresh_token: 'fake-plugin-refresh-token',
          client_id: 'fake-plugin-client-id',
          client_secret: 'fake-plugin-secret',
          session_started_at: 0,
          access_token_expires_at: 9999999999,
        }, null, 2));
      }
    }

    // Build environment for subprocess
    const env = { ...process.env };
    // Hermetic: a developer's exported credentials or overrides must not reach the probe
    delete env.OUTLOOK_CLIENT_ID;
    delete env.OUTLOOK_CLIENT_SECRET;
    delete env.OUTLOOK_SKILLS_HOME;
    delete env.OUTLOOK_TOKEN_FILE;

    // Set HOME and USERPROFILE based on scenario. Windows-only rows set them
    // differently (HOME != USERPROFILE, state under USERPROFILE); others match.
    if (scenario.windows_only) {
      env.HOME = homeDir + '_different';
      env.USERPROFILE = homeDir;
    } else {
      env.HOME = homeDir;
      env.USERPROFILE = homeDir;
    }

    // Apply scenario env overrides
    const envVars = scenario.env || {};
    for (const [key, value] of Object.entries(envVars)) {
      if (value === '<override>') {
        // Use a distinct override directory
        overrideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlook-fixture-override-'));
        fs.writeFileSync(path.join(overrideDir, '.env'),
          'OUTLOOK_CLIENT_ID=fake-override-client-id\n' +
          'OUTLOOK_CLIENT_SECRET=fake-override-secret\n'
        );
        fs.writeFileSync(path.join(overrideDir, 'tokens.json'), JSON.stringify({
          access_token: 'fake-override-access-token',
          refresh_token: 'fake-override-refresh-token',
          client_id: 'fake-override-client-id',
          client_secret: 'fake-override-secret',
          session_started_at: 0,
          access_token_expires_at: 9999999999,
        }, null, 2));
        env[key] = overrideDir;
      } else if (value === '') {
        env[key] = '';
      } else if (value === '<tokenfile>') {
        // Custom token file path
        const tokenFile = path.join(homeDir, 'custom-tokens.json');
        fs.writeFileSync(tokenFile, JSON.stringify({
          access_token: 'fake-custom-token',
          refresh_token: 'fake-custom-refresh',
          client_id: 'fake-custom-client',
          client_secret: 'fake-custom-secret',
          session_started_at: 0,
          access_token_expires_at: 9999999999,
        }, null, 2));
        env[key] = tokenFile;
      } else {
        env[key] = value;
      }
    }

    return {
      pluginDir,
      homeDir,
      env,
      cleanup,
      _overrideDir: overrideDir,
    };
  } catch (e) {
    cleanup();
    throw e;
  }
}

/**
 * Run `node auth-server.js --where` as a subprocess and parse the JSON output.
 *
 * @param {string} pluginDir - Path to the fixture's plugin tree
 * @param {Object} env - Environment dict for the subprocess
 * @param {string} [cwd] - Working directory for the subprocess (relative overrides resolve here)
 * @returns {Object} Parsed JSON dict from --where output
 */
function runWhere(pluginDir, env, cwd) {
  const serverPath = path.join(pluginDir, 'outlook-skills', 'auth-server.js');
  const result = spawnSync(process.execPath, [serverPath, '--where'], {
    env,
    cwd: cwd || pluginDir,
    encoding: 'utf8',
    timeout: 10000,
  });

  if (result.status !== 0) {
    throw new Error(
      `--where failed with exit code ${result.status}\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  return JSON.parse(result.stdout);
}

/**
 * Compute expected absolute paths for a scenario.
 *
 * @param {Object} scenario - The scenario row
 * @param {Object} fixture - The built fixture dict
 * @returns {Object} Dict with state_dir, token_file and checked_dirs as absolute path strings
 */
function getExpectedPaths(scenario, fixture) {
  const { homeDir, pluginDir, env } = fixture;
  const outlookSkillsDir = path.join(pluginDir, 'outlook-skills');

  // State dir is ~/.outlook-skills, not ~ directly
  const homeVar = process.platform === 'win32' ? 'USERPROFILE' : 'HOME';
  const homeBase = env[homeVar] || homeDir;
  const paths = {
    override: env.OUTLOOK_SKILLS_HOME ? path.resolve(env.OUTLOOK_SKILLS_HOME) : '',
    plugin: outlookSkillsDir,
    home: path.join(homeBase, '.outlook-skills'),
  };

  const stateDirKey = scenario.expected_state_dir || 'home';
  const stateDir = paths[stateDirKey];

  // Determine expected token_file
  let tokenFile;
  if (scenario.expected_token_file === 'override') {
    tokenFile = path.resolve(env.OUTLOOK_TOKEN_FILE || '');
  } else {
    tokenFile = path.join(stateDir, 'tokens.json');
  }

  return {
    state_dir: stateDir,
    token_file: tokenFile,
    checked_dirs: scenario.expected_checked_dirs.map(d => paths[d]),
  };
}

module.exports = {
  buildFixture,
  runWhere,
  getExpectedPaths,
  REPO_ROOT,
};
