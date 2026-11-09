// Tests for MCP module state directory lookup (mcp-server/src/auth.js).
// Mirrors test/python/state_dir_test.py pattern: fixture builder + subprocess probes.
// Never imports auth.js directly — runs it as a subprocess with fixture environment.

import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { platform, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const IS_WIN = platform() === 'win32';

// Allowlist of files to copy from repo into fixture plugin tree.
const ALLOWLIST = [
  'mcp-server/src/auth.js',
  'mcp-server/package.json',
  'outlook-skills/.env.example',
  'outlook-skills/auth.sh',
  'outlook-skills/auth.ps1',
];

const FIXTURE_SECRETS = [
  'fake-secret-for-tests',
  'fake-client-id-for-tests',
  'fake-access-token-for-tests',
  'fake-refresh-token-for-tests',
  'fake-plugin-secret',
  'fake-plugin-client-id',
  'fake-override-secret',
  'fake-custom-secret',
];

const scenariosPath = join(REPO_ROOT, 'test', 'fixtures', 'state-dir-scenarios.json');
const scenarios = JSON.parse(await import('node:fs').then(fs => fs.readFileSync(scenariosPath, 'utf8')));

function buildFixture(scenario) {
  const pluginDir = mkdtempSync(join(tmpdir(), 'outlook-fixture-plugin-'));
  const homeDir = mkdtempSync(join(tmpdir(), 'outlook-fixture-home-'));

  try {
    for (const relPath of ALLOWLIST) {
      const src = join(REPO_ROOT, relPath);
      if (!existsSync(src)) throw new Error(`Allowlisted file not found: ${src}`);
      const dst = join(pluginDir, relPath);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
    }

    const outlookDir = join(pluginDir, 'outlook-skills');
    if (existsSync(join(outlookDir, '.env'))) {
      throw new Error(`Fixture plugin tree already contains .env at ${outlookDir}`);
    }
    if (existsSync(join(outlookDir, 'tokens.json'))) {
      throw new Error(`Fixture plugin tree already contains tokens.json at ${outlookDir}`);
    }

    const homeFiles = scenario.home || [];
    const pluginFiles = scenario.plugin || [];
    const homeStateDir = join(homeDir, '.outlook-skills');
    mkdirSync(homeStateDir, { recursive: true });

    for (const fname of homeFiles) {
      const fpath = join(homeStateDir, fname);
      if (fname === '.env') {
        writeFileSync(fpath, 'OUTLOOK_CLIENT_ID=fake-client-id-for-tests\nOUTLOOK_CLIENT_SECRET=fake-secret-for-tests\n');
      } else if (fname === 'tokens.json') {
        writeFileSync(fpath, JSON.stringify({
          access_token: 'fake-access-token-for-tests',
          refresh_token: 'fake-refresh-token-for-tests',
          client_id: 'fake-client-id-for-tests',
          client_secret: 'fake-secret-for-tests',
          session_started_at: 0,
          access_token_expires_at: 9999999999,
        }));
      }
    }

    for (const fname of pluginFiles) {
      const fpath = join(outlookDir, fname);
      if (fname === '.env') {
        writeFileSync(fpath, 'OUTLOOK_CLIENT_ID=fake-plugin-client-id\nOUTLOOK_CLIENT_SECRET=fake-plugin-secret\n');
      } else if (fname === 'tokens.json') {
        writeFileSync(fpath, JSON.stringify({
          access_token: 'fake-plugin-access-token',
          refresh_token: 'fake-plugin-refresh-token',
          client_id: 'fake-plugin-client-id',
          client_secret: 'fake-plugin-secret',
          session_started_at: 0,
          access_token_expires_at: 9999999999,
        }));
      }
    }

    const env = {};
    delete env.OUTLOOK_CLIENT_ID;
    delete env.OUTLOOK_CLIENT_SECRET;
    delete env.OUTLOOK_SKILLS_HOME;
    delete env.OUTLOOK_TOKEN_FILE;

    if (scenario.id === 10) {
      env.HOME = join(homeDir, '_different');
      env.USERPROFILE = homeDir;
    } else {
      env.HOME = homeDir;
      env.USERPROFILE = homeDir;
    }

    const envVars = scenario.env || {};
    const cleanupDirs = [];
    for (const [key, value] of Object.entries(envVars)) {
      if (value === '<override>') {
        const overrideDir = mkdtempSync(join(tmpdir(), 'outlook-fixture-override-'));
        writeFileSync(join(overrideDir, '.env'), 'OUTLOOK_CLIENT_ID=fake-override-client-id\nOUTLOOK_CLIENT_SECRET=fake-override-secret\n');
        writeFileSync(join(overrideDir, 'tokens.json'), JSON.stringify({
          access_token: 'fake-override-access-token',
          refresh_token: 'fake-override-refresh-token',
          client_id: 'fake-override-client-id',
          client_secret: 'fake-override-secret',
          session_started_at: 0,
          access_token_expires_at: 9999999999,
        }));
        env[key] = overrideDir;
        cleanupDirs.push(overrideDir);
      } else if (value === '') {
        env[key] = '';
      } else if (value === '<tokenfile>') {
        const tokenFile = join(homeDir, 'custom-tokens.json');
        writeFileSync(tokenFile, JSON.stringify({
          access_token: 'fake-custom-token',
          refresh_token: 'fake-custom-refresh',
          client_id: 'fake-custom-client',
          client_secret: 'fake-custom-secret',
          session_started_at: 0,
          access_token_expires_at: 9999999999,
        }));
        env[key] = tokenFile;
      } else {
        env[key] = value;
      }
    }

    return {
      pluginDir,
      homeDir,
      env,
      cleanupDirs,
      cleanup: () => {
        rmSync(pluginDir, { recursive: true, force: true });
        rmSync(homeDir, { recursive: true, force: true });
        for (const d of cleanupDirs) rmSync(d, { recursive: true, force: true });
      },
    };
  } catch (e) {
    rmSync(pluginDir, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
    throw e;
  }
}

function runWhere(pluginDir, env, cwd) {
  const authPath = join(pluginDir, 'mcp-server', 'src', 'auth.js');
  const authUrl = IS_WIN ? `file:///${authPath.replace(/\\/g, '/')}` : `file://${authPath}`;
  const program = `import { resolveStateDir } from "${authUrl}"; console.log(JSON.stringify(resolveStateDir()));`;

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
    env, cwd, encoding: 'utf8', timeout: 10000,
  });

  if (result.status !== 0) {
    throw new Error(`--where failed with exit code ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function getExpectedPaths(scenario, fixture) {
  const { homeDir, pluginDir, env } = fixture;
  const homeStateDir = join(homeDir, '.outlook-skills');
  const pluginStateDir = join(pluginDir, 'outlook-skills');

  const paths = {
    override: env.OUTLOOK_SKILLS_HOME || '',
    plugin: pluginStateDir,
    home: homeStateDir,
  };

  const stateDirKey = scenario.expected_state_dir || 'home';
  const stateDir = paths[stateDirKey];
  let tokenFile = scenario.expected_token_file === 'override' ? env.OUTLOOK_TOKEN_FILE : join(stateDir, 'tokens.json');
  const checkedDirs = scenario.expected_checked_dirs.map(d => paths[d]);

  return { state_dir: stateDir, token_file: tokenFile, checked_dirs: checkedDirs };
}

// Run the auth probe (getToken()) as a subprocess to test error messages.
// Imports the REAL auth.js module with network stubbed.
function runAuthProbe(pluginDir, env) {
  const authPath = join(pluginDir, 'mcp-server', 'src', 'auth.js');
  // On Windows, absolute paths must be file:// URLs for ESM imports.
  const authUrl = IS_WIN ? `file:///${authPath.replace(/\\/g, '/')}` : `file://${authPath}`;
  
  // Write the probe program to a temp file to avoid escaping issues with -e
  const probeDir = mkdtempSync(join(tmpdir(), 'outlook-probe-'));
  const probeFile = join(probeDir, 'probe.js');
  // auth.js uses globalThis.fetch for HTTP requests, so we stub that before importing.
  const program = `// Stub fetch BEFORE importing auth.js
globalThis.fetch = () => { throw new Error('network access attempted during auth-message test'); };

import { getToken, AuthRequiredError } from "${authUrl}";

try {
  await getToken();
  console.log(JSON.stringify({ type: null, message: '' }));
  process.exit(2);
} catch (e) {
  if (e instanceof AuthRequiredError) {
    console.log(JSON.stringify({ type: 'AuthRequiredError', message: e.message }));
    process.exit(1);
  }
  console.log(JSON.stringify({ type: e.name || 'Error', message: e.message }));
  process.exit(3);
}
`;
  writeFileSync(probeFile, program);

  const result = spawnSync(process.execPath, [probeFile], {
    env, encoding: 'utf8', timeout: 20000,
  });

  rmSync(probeDir, { recursive: true, force: true });

  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
}

function expectedAuthCmd(scriptDir, action) {
  if (IS_WIN) {
    const scriptPath = resolve(scriptDir, 'auth.ps1');
    return `powershell -NoProfile -File "${scriptPath}" -${action.charAt(0).toUpperCase() + action.slice(1)}`;
  }
  const scriptPath = resolve(scriptDir, 'auth.sh');
  return `bash "${scriptPath}" --${action}`;
}

// Test all scenarios from the shared table.
for (const scenario of scenarios) {
  test(`scenario ${scenario.id}: ${scenario.description}`, async () => {
    if (scenario.windows_only && !IS_WIN) return;

    let fixture = null;
    try {
      fixture = buildFixture(scenario);
      const result = runWhere(fixture.pluginDir, fixture.env);
      const expected = getExpectedPaths(scenario, fixture);

      assert.strictEqual(result.state_dir, expected.state_dir, `Scenario ${scenario.id}: state_dir mismatch`);
      assert.strictEqual(result.token_file, expected.token_file, `Scenario ${scenario.id}: token_file mismatch`);
      assert.deepStrictEqual(result.checked_dirs, expected.checked_dirs, `Scenario ${scenario.id}: checked_dirs mismatch`);
    } finally {
      if (fixture) fixture.cleanup();
    }
  });
}

// Test the overwrite bug: home has .env with fake-home-secret, plugin has .env with fake-template-secret.
// The module should load only from home (the chosen state dir).
test('overwrite bug: .env loaded only from chosen state dir', async () => {
  const scenario = {
    id: 998, env: {}, home: ['.env', 'tokens.json'], plugin: ['.env', 'tokens.json'],
    windows_only: false, expected_state_dir: 'home', expected_token_file: 'state_dir', expected_checked_dirs: ['home'],
  };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');
    const pluginStateDir = join(fixture.pluginDir, 'outlook-skills');

    writeFileSync(join(homeStateDir, '.env'), 'OUTLOOK_CLIENT_SECRET=fake-home-secret\n');
    writeFileSync(join(pluginStateDir, '.env'), 'OUTLOOK_CLIENT_SECRET=fake-template-secret\n');

    // Run a probe that prints a boolean, not the secret itself.
    const authPath = join(fixture.pluginDir, 'mcp-server', 'src', 'auth.js');
    const authUrl = IS_WIN ? `file:///${authPath.replace(/\\/g, '/')}` : `file://${authPath}`;
    const program = `import "${authUrl}"; console.log(JSON.stringify({ is_home_secret: process.env.OUTLOOK_CLIENT_SECRET === "fake-home-secret" }));`;

    const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
      env: fixture.env, encoding: 'utf8', timeout: 10000,
    });

    assert.strictEqual(result.status, 0, `overwrite probe exited ${result.status}: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.is_home_secret, true, 'client_secret should come from home .env, not plugin .env (overwrite bug)');
  } finally {
    if (fixture) fixture.cleanup();
  }
});

// Test sign-in message contents for missing token file.
test('sign-in message: missing token file includes checked dirs, exact command, no secrets', async () => {
  const scenario = { id: 999, env: {}, home: [], plugin: [], windows_only: false };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);
    const result = runAuthProbe(fixture.pluginDir, fixture.env);

    assert.strictEqual(result.exitCode, 1, `expected AuthRequiredError: exit=${result.exitCode}`);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.type, 'AuthRequiredError');

    const message = payload.message;
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');
    const pluginStateDir = join(fixture.pluginDir, 'outlook-skills');
    const cmd = expectedAuthCmd(pluginStateDir, 'reauth');

    assert.ok(message.includes('No token file found'), `message should include "No token file found": ${message}`);
    assert.ok(message.includes(`Checked: ${homeStateDir}; ${pluginStateDir}.`), `message should include checked dirs: ${message}`);
    assert.ok(message.endsWith(`Run: ${cmd}`), `message should end with reauth command: ${message}`);

    for (const secret of FIXTURE_SECRETS) {
      assert.ok(!message.includes(secret), `secret "${secret}" should not appear in message`);
    }
  } finally {
    if (fixture) fixture.cleanup();
  }
});

// Test missing .env error message (client_secret not found path).
test('sign-in message: missing .env includes copy advice naming resolved state dir', async () => {
  const scenario = { id: 1000, env: {}, home: [], plugin: ['tokens.json'], windows_only: false };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);
    const pluginStateDir = join(fixture.pluginDir, 'outlook-skills');
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');

    // Write expired tokens (no client_secret) to trigger the missing .env error.
    writeFileSync(join(pluginStateDir, 'tokens.json'), JSON.stringify({
      access_token: 'fake-token',
      refresh_token: 'fake-refresh',
      client_id: 'fake-client',
      session_started_at: Date.now() / 1000,
      access_token_expires_at: 0, // expired
    }));

    const result = runAuthProbe(fixture.pluginDir, fixture.env);

    assert.strictEqual(result.exitCode, 1, `expected AuthRequiredError: exit=${result.exitCode}`);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.type, 'AuthRequiredError');

    const message = payload.message;
    const cmd = expectedAuthCmd(pluginStateDir, 'reauth');
    const copyAdvice = `Copy your existing .env to ${pluginStateDir}, then run: ${cmd}`;

    assert.ok(message.includes(`Checked: ${homeStateDir}; ${pluginStateDir}.`), `message should include checked dirs: ${message}`);
    assert.ok(message.endsWith(copyAdvice), `message should end with copy advice: ${message}`);

    // Check that "azure" or "regist" does not precede the copy advice.
    const copyAt = message.indexOf('Copy your existing .env');
    const lowered = message.toLowerCase();
    for (const mention of ['azure', 'regist']) {
      const mentionAt = lowered.indexOf(mention);
      if (mentionAt !== -1) assert.ok(mentionAt > copyAt, `'${mention}' must not precede copy advice`);
    }

    for (const secret of FIXTURE_SECRETS) {
      assert.ok(!message.includes(secret), `secret "${secret}" should not appear in message`);
    }
  } finally {
    if (fixture) fixture.cleanup();
  }
});

// Relative overrides are made absolute against the process cwd, not the module's folder.
test('relative OUTLOOK_SKILLS_HOME and OUTLOOK_TOKEN_FILE resolve from cwd', async () => {
  let fixture = null;
  try {
    fixture = buildFixture({ id: 'relative', env: {}, home: [], plugin: [], windows_only: false });
    const env = { ...fixture.env, OUTLOOK_SKILLS_HOME: 'rel-state', OUTLOOK_TOKEN_FILE: 'rel-tokens.json' };

    const result = runWhere(fixture.pluginDir, env, fixture.homeDir);

    const stateDir = resolve(fixture.homeDir, 'rel-state');
    assert.strictEqual(result.state_dir, stateDir, 'state_dir should be absolute, resolved from cwd');
    assert.strictEqual(result.token_file, resolve(fixture.homeDir, 'rel-tokens.json'), 'token_file should be absolute, resolved from cwd');
    assert.deepStrictEqual(result.checked_dirs, [stateDir], 'rule 1 checks only the override');
  } finally {
    if (fixture) fixture.cleanup();
  }
});

// A leading ~ expands to the home directory, as token_helper.py's expanduser() does.
test('leading ~ in OUTLOOK_SKILLS_HOME and OUTLOOK_TOKEN_FILE expands to home', async () => {
  let fixture = null;
  try {
    fixture = buildFixture({ id: 'tilde', env: {}, home: [], plugin: [], windows_only: false });
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');
    const pluginStateDir = join(fixture.pluginDir, 'outlook-skills');

    const skillsHome = runWhere(fixture.pluginDir,
      { ...fixture.env, OUTLOOK_SKILLS_HOME: '~/custom-state' }, fixture.homeDir);
    assert.strictEqual(skillsHome.state_dir, join(fixture.homeDir, 'custom-state'), 'OUTLOOK_SKILLS_HOME ~/ expands to home');
    assert.strictEqual(skillsHome.token_file, join(fixture.homeDir, 'custom-state', 'tokens.json'));
    assert.deepStrictEqual(skillsHome.checked_dirs, [join(fixture.homeDir, 'custom-state')]);

    const tokenFile = runWhere(fixture.pluginDir,
      { ...fixture.env, OUTLOOK_TOKEN_FILE: '~/custom-tokens.json' }, fixture.homeDir);
    assert.strictEqual(tokenFile.token_file, join(fixture.homeDir, 'custom-tokens.json'), 'OUTLOOK_TOKEN_FILE ~/ expands to home');
    assert.strictEqual(tokenFile.state_dir, homeStateDir, 'token-only override leaves the lookup unchanged');
    assert.deepStrictEqual(tokenFile.checked_dirs, [homeStateDir, pluginStateDir]);
  } finally {
    if (fixture) fixture.cleanup();
  }
});

// "Holds state" means a FILE, as in token_helper.py (is_file) and auth-server.js.
test('a directory named tokens.json is not state, in home or in the plugin folder', async () => {
  const cases = [
    { name: 'home has a tokens.json directory', dirIn: 'home', plugin: ['tokens.json'],
      expected_state_dir: 'plugin', expected_checked_dirs: ['home', 'plugin'] },
    { name: 'plugin has a tokens.json directory', dirIn: 'plugin', plugin: [],
      expected_state_dir: 'home', expected_checked_dirs: ['home', 'plugin'] },
  ];
  for (const c of cases) {
    const scenario = { id: c.name, env: {}, home: [], plugin: c.plugin, windows_only: false,
      expected_state_dir: c.expected_state_dir, expected_token_file: 'state_dir',
      expected_checked_dirs: c.expected_checked_dirs };
    let fixture = null;
    try {
      fixture = buildFixture(scenario);
      const parent = c.dirIn === 'home'
        ? join(fixture.homeDir, '.outlook-skills')
        : join(fixture.pluginDir, 'outlook-skills');
      mkdirSync(join(parent, 'tokens.json'), { recursive: true });

      const result = runWhere(fixture.pluginDir, fixture.env);
      const expected = getExpectedPaths(scenario, fixture);
      assert.strictEqual(result.state_dir, expected.state_dir, `${c.name}: state_dir`);
      assert.deepStrictEqual(result.checked_dirs, expected.checked_dirs, `${c.name}: checked_dirs`);
    } finally {
      if (fixture) fixture.cleanup();
    }
  }
});
