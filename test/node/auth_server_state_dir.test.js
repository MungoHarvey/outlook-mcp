/**
 * test/node/auth_server_state_dir.test.js
 *
 * Tests for state directory lookup logic in auth-server.js.
 * Runs the --where command as a subprocess for each scenario in the shared
 * scenario table, asserting state_dir, token_file, and checked_dirs.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { buildFixture, runWhere, getExpectedPaths, REPO_ROOT } = require('./state_fixture');

// Load the shared scenario table
const scenariosPath = path.join(REPO_ROOT, 'test', 'fixtures', 'state-dir-scenarios.json');
const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));

// Values the fixtures write into auth state; none may appear in an error message.
const FIXTURE_SECRETS = [
  'fake-secret-for-tests',
  'fake-client-id-for-tests',
  'fake-access-token-for-tests',
  'fake-refresh-token-for-tests',
  'fake-plugin-client-id',
  'fake-plugin-secret',
  'fake-plugin-access-token',
  'fake-plugin-refresh-token',
];

/**
 * Run the auth server with no flags (should fail fast before browser/network)
 * and capture exit code and output.
 */
function runAuthNoFlags(pluginDir, env) {
  const serverPath = path.join(pluginDir, 'outlook-skills', 'auth-server.js');
  const result = spawnSync(process.execPath, [serverPath], {
    env,
    encoding: 'utf8',
    timeout: 10000,
  });
  return result;
}

/**
 * Run the launcher script for this platform with --where/-Where.
 */
function runLauncherWhere(pluginDir, env) {
  const isWindows = process.platform === 'win32';
  let result;

  if (isWindows) {
    const launcherPath = path.join(pluginDir, 'outlook-skills', 'auth.ps1');
    result = spawnSync('powershell', ['-NoProfile', '-File', launcherPath, '-Where'], {
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
  } else {
    const launcherPath = path.join(pluginDir, 'outlook-skills', 'auth.sh');
    result = spawnSync('bash', [launcherPath, '--where'], {
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
  }

  if (result.status !== 0) {
    throw new Error(
      `Launcher --where failed with exit code ${result.status}\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  return JSON.parse(result.stdout);
}

/**
 * Get the expected auth command for the platform.
 */
function getExpectedAuthCmd(scriptDir, action) {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const ps1Path = path.join(scriptDir, 'auth.ps1');
    const actionCap = action.charAt(0).toUpperCase() + action.slice(1);
    return `powershell -NoProfile -File "${ps1Path}" -${actionCap}`;
  }
  const shPath = path.join(scriptDir, 'auth.sh');
  return `bash "${shPath}" --${action}`;
}

// ── Test: All scenario rows for auth-server.js ──────────────────────────────
test('auth-server.js --where: all scenario rows', async () => {
  for (const scenario of scenarios) {
    // Skip Windows-only scenarios on non-Windows
    if (scenario.windows_only && process.platform !== 'win32') {
      continue;
    }

    let fixture = null;
    try {
      fixture = buildFixture(scenario);
      const result = runWhere(fixture.pluginDir, fixture.env);
      const expected = getExpectedPaths(scenario, fixture);

      assert.strictEqual(
        result.state_dir,
        expected.state_dir,
        `Scenario ${scenario.id}: state_dir mismatch`
      );
      assert.strictEqual(
        result.token_file,
        expected.token_file,
        `Scenario ${scenario.id}: token_file mismatch`
      );
      assert.deepStrictEqual(
        result.checked_dirs,
        expected.checked_dirs,
        `Scenario ${scenario.id}: checked_dirs mismatch`
      );
    } finally {
      if (fixture) {
        fixture.cleanup();
      }
    }
  }
});

// ── Test: All scenario rows for launcher ────────────────────────────────────
test('launcher --where/-Where: all scenario rows', async () => {
  for (const scenario of scenarios) {
    // Skip Windows-only scenarios on non-Windows
    if (scenario.windows_only && process.platform !== 'win32') {
      continue;
    }

    let fixture = null;
    try {
      fixture = buildFixture(scenario);
      const result = runLauncherWhere(fixture.pluginDir, fixture.env);
      const expected = getExpectedPaths(scenario, fixture);

      assert.strictEqual(
        result.state_dir,
        expected.state_dir,
        `Scenario ${scenario.id}: state_dir mismatch`
      );
      assert.strictEqual(
        result.token_file,
        expected.token_file,
        `Scenario ${scenario.id}: token_file mismatch`
      );
      assert.deepStrictEqual(
        result.checked_dirs,
        expected.checked_dirs,
        `Scenario ${scenario.id}: checked_dirs mismatch`
      );
    } finally {
      if (fixture) {
        fixture.cleanup();
      }
    }
  }
});

// ── Test: Relative overrides are reported absolute ──────────────────────────
test('relative OUTLOOK_SKILLS_HOME and OUTLOOK_TOKEN_FILE are reported absolute', async () => {
  // Use scenario 8 (nothing anywhere) as base
  const scenario = {
    id: 999,
    env: {},
    home: [],
    plugin: [],
    windows_only: false,
    expected_state_dir: 'home',
    expected_token_file: 'state_dir',
    expected_checked_dirs: ['home', 'plugin'],
  };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);
    const cwd = fixture.homeDir;

    // Set relative paths for OUTLOOK_SKILLS_HOME and OUTLOOK_TOKEN_FILE
    const relEnv = { ...fixture.env };
    relEnv.OUTLOOK_SKILLS_HOME = 'relative-state';
    relEnv.OUTLOOK_TOKEN_FILE = 'relative-tokens.json';

    const result = runWhere(fixture.pluginDir, relEnv, cwd);

    const expectedStateDir = path.resolve(cwd, 'relative-state');
    const expectedTokenFile = path.resolve(cwd, 'relative-tokens.json');

    assert.strictEqual(result.state_dir, expectedStateDir);
    assert.strictEqual(result.token_file, expectedTokenFile);
    assert.deepStrictEqual(result.checked_dirs, [expectedStateDir]);
  } finally {
    if (fixture) {
      fixture.cleanup();
    }
  }
});

// ── Test: Directory named tokens.json does NOT count as state ───────────────
test('directory named tokens.json in home does not count as state', async () => {
  // Scenario: home has a DIRECTORY named tokens.json (not a file), plugin empty
  // Expected: home doesn't count, so we fall through to plugin (empty), then default to home
  // Result: state_dir = home, checked_dirs = [home, plugin]
  const scenario = {
    id: 998,
    env: {},
    home: [],  // No files, we'll create a directory manually
    plugin: [],
    windows_only: false,
    expected_state_dir: 'home',
    expected_token_file: 'state_dir',
    expected_checked_dirs: ['home', 'plugin'],
  };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);

    // Create a DIRECTORY named tokens.json in home/.outlook-skills (not a file)
    const homeStateDir = path.join(fixture.homeDir, '.outlook-skills');
    const fakeTokensDir = path.join(homeStateDir, 'tokens.json');
    fs.mkdirSync(fakeTokensDir, { recursive: true });

    const result = runWhere(fixture.pluginDir, fixture.env);

    // Should fall through to default (home) because directory doesn't count
    const expectedHomeState = path.join(fixture.homeDir, '.outlook-skills');
    const expectedPluginState = path.join(fixture.pluginDir, 'outlook-skills');

    assert.strictEqual(result.state_dir, expectedHomeState);
    assert.strictEqual(result.token_file, path.join(expectedHomeState, 'tokens.json'));
    assert.deepStrictEqual(result.checked_dirs, [expectedHomeState, expectedPluginState]);
  } finally {
    if (fixture) {
      fixture.cleanup();
    }
  }
});

// ── Test: Missing .env error message ────────────────────────────────────────
test('missing .env error message: ordered checked dirs, exact platform command, copy advice first, no secrets', () => {
  // Scenario with no .env anywhere, but tokens exist (so we hit the missing .env path)
  const scenario = {
    id: 997,
    env: {},
    home: [],
    plugin: ['tokens.json'],
    windows_only: false,
    expected_state_dir: 'plugin',
    expected_token_file: 'state_dir',
  };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);
    const result = runAuthNoFlags(fixture.pluginDir, fixture.env);

    // Should fail with non-zero exit
    assert.notStrictEqual(result.status, 0, 'Expected non-zero exit code');

    const output = result.stdout + result.stderr;

    // Check ordered checked dirs
    const homeState = path.join(fixture.homeDir, '.outlook-skills');
    const pluginState = path.join(fixture.pluginDir, 'outlook-skills');
    assert.ok(
      output.includes(homeState) && output.includes(pluginState),
      `Output should list checked dirs in order: ${output}`
    );
    // Verify order: home should appear before plugin
    const homeIdx = output.indexOf(homeState);
    const pluginIdx = output.indexOf(pluginState);
    assert.ok(
      homeIdx < pluginIdx,
      `Home dir should appear before plugin dir: ${output}`
    );

    // Check exact platform command for reauth
    const expectedCmd = getExpectedAuthCmd(pluginState, 'reauth');
    assert.ok(
      output.includes(expectedCmd),
      `Output should include the exact reauth command: ${expectedCmd}`
    );

    // Check copy advice comes before any Azure mention
    const copyAdvice = `Copy your existing .env to ${pluginState}`;
    const copyIdx = output.indexOf(copyAdvice);
    assert.notStrictEqual(copyIdx, -1, `Output should include copy advice: ${copyAdvice}`);

    // Check the template copy command comes after the copy advice
    const templateCopy = process.platform === 'win32'
      ? `Copy-Item "${path.join(pluginState, '.env.example')}"`
      : `cp -n "${path.join(pluginState, '.env.example')}"`;
    const templateIdx = output.indexOf(templateCopy);
    assert.ok(templateIdx > copyIdx, 'Template copy command should come after copy advice');

    // Check directory creation command is included (fresh machine advice)
    // The command creates the STATE_DIR (where .env should live)
    const createDirCmd = process.platform === 'win32'
      ? `New-Item -ItemType Directory -Force "${pluginState}"`
      : `mkdir -p "${pluginState}"`;
    assert.ok(
      output.includes(createDirCmd),
      `Output should include directory creation command: ${createDirCmd}. Got: ${output}`
    );

    // The second reauth command follows the template copy line
    assert.ok(
      output.lastIndexOf(expectedCmd) > templateIdx,
      `Second reauth command should come after the template copy line: ${output}`
    );

    // The Azure line must exist and come after the copy advice
    const azureIdx = output.toLowerCase().indexOf('azure');
    assert.notStrictEqual(azureIdx, -1, `Output should mention Azure app setup: ${output}`);
    assert.ok(azureIdx > copyIdx, 'Azure mention must come after copy advice');

    // The message names only the reauth command, never a status check
    assert.ok(
      !output.includes('-Status') && !output.includes('--status'),
      `Missing-.env message should not mention status: ${output}`
    );

    // Check no fixture secrets leak
    for (const secret of FIXTURE_SECRETS) {
      assert.ok(
        !output.includes(secret),
        `Secret '${secret}' should not appear in output: ${output}`
      );
    }
  } finally {
    if (fixture) {
      fixture.cleanup();
    }
  }
});

// ── Test: --where runs before .env is read ──────────────────────────────────
test('--where exits 0 when OUTLOOK_SKILLS_HOME holds a directory named .env', () => {
  const scenario = {
    id: 996,
    env: {},
    home: [],
    plugin: [],
    windows_only: false,
    expected_state_dir: 'home',
    expected_token_file: 'state_dir',
    expected_checked_dirs: ['home', 'plugin'],
  };

  let fixture = null;
  let overrideDir = null;
  try {
    fixture = buildFixture(scenario);
    overrideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlook-where-direnv-'));
    fs.mkdirSync(path.join(overrideDir, '.env'));

    const env = { ...fixture.env, OUTLOOK_SKILLS_HOME: overrideDir };
    const result = runWhere(fixture.pluginDir, env);

    assert.strictEqual(result.state_dir, overrideDir);
    assert.strictEqual(result.token_file, path.join(overrideDir, 'tokens.json'));
    assert.deepStrictEqual(result.checked_dirs, [overrideDir]);
  } finally {
    if (fixture) {
      fixture.cleanup();
    }
    if (overrideDir) {
      fs.rmSync(overrideDir, { recursive: true, force: true });
    }
  }
});

// ── Test: --status "not authenticated" message uses the platform command ────
// A .env that exists but lacks credentials must not be replaced: the message
// says to fill it in, and advises no template copy that would overwrite it.
test('missing-credentials message with an existing but incomplete .env advises no template copy', () => {
  const scenario = {
    id: 996,
    env: {},
    home: [],
    plugin: ['tokens.json'],
    windows_only: false,
    expected_state_dir: 'plugin',
    expected_token_file: 'state_dir',
  };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);
    const pluginState = path.join(fixture.pluginDir, 'outlook-skills');
    const envFile = path.join(pluginState, '.env');
    // Tenant only: no client id or secret, so the credentials check fails.
    fs.writeFileSync(envFile, 'OUTLOOK_TENANT_ID=common\n');

    const result = runAuthNoFlags(fixture.pluginDir, fixture.env);
    const output = result.stdout + result.stderr;

    // Reach the credentials check, not some earlier exit.
    assert.strictEqual(result.status, 1, `Expected exit 1: ${output}`);
    assert.ok(output.includes('must be set in a .env file'), `Expected the credentials error: ${output}`);

    assert.ok(
      output.includes(`Fill in the missing values in ${envFile}`),
      `Expected fill-in advice naming the existing .env: ${output}`
    );
    const templateSrc = path.join(pluginState, '.env.example');
    assert.ok(
      !output.includes(`Copy-Item "${templateSrc}"`) && !output.includes(`cp "${templateSrc}"`),
      `Must not advise copying the template over an existing .env: ${output}`
    );
    assert.ok(
      !output.includes('Copy your existing .env'),
      `Must not advise copying an existing .env when one is already there: ${output}`
    );
    // The existing file is untouched.
    assert.strictEqual(fs.readFileSync(envFile, 'utf8'), 'OUTLOOK_TENANT_ID=common\n');
  } finally {
    if (fixture) {
      fixture.cleanup();
    }
  }
});

test('--status not-authenticated message gives the exact platform reauth command', () => {
  const scenario = {
    id: 995,
    env: {},
    home: [],
    plugin: [],
    windows_only: false,
    expected_state_dir: 'home',
    expected_token_file: 'state_dir',
    expected_checked_dirs: ['home', 'plugin'],
  };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);
    const serverPath = path.join(fixture.pluginDir, 'outlook-skills', 'auth-server.js');
    const result = spawnSync(process.execPath, [serverPath, '--status'], {
      env: fixture.env,
      encoding: 'utf8',
      timeout: 10000,
    });

    assert.strictEqual(result.status, 0, `--status should exit 0: ${result.stderr}`);
    const expectedCmd = getExpectedAuthCmd(path.join(fixture.pluginDir, 'outlook-skills'), 'reauth');
    const homeStateDir = path.join(fixture.homeDir, '.outlook-skills');
    const pluginSkillsDir = path.join(fixture.pluginDir, 'outlook-skills');
    assert.ok(
      result.stdout.includes(`Not authenticated. Checked: ${homeStateDir}; ${pluginSkillsDir}. Run: ${expectedCmd}`),
      `Expected the exact reauth command in: ${result.stdout}`
    );
  } finally {
    if (fixture) {
      fixture.cleanup();
    }
  }
});

// ── Test: every recovery message gives the exact platform reauth command ────
test('--revoke, corrupt-store and missing-scope messages give the exact platform reauth command', () => {
  const cases = [
    { name: 'revoke', args: ['--revoke'], tokens: null },
    { name: 'corrupt token store', args: ['--status'], tokens: 'not json' },
    { name: 'missing scopes', args: ['--status'],
      tokens: JSON.stringify({ access_token: 'fake-access-token-for-tests', scopes: [],
        session_started_at: Math.floor(Date.now() / 1000), access_token_expires_at: 0 }) },
  ];
  for (const c of cases) {
    const scenario = { id: `recovery-${c.name}`, env: {}, home: ['.env', 'tokens.json'], plugin: [],
      windows_only: false, expected_state_dir: 'home', expected_token_file: 'state_dir',
      expected_checked_dirs: ['home'] };
    let fixture = null;
    try {
      fixture = buildFixture(scenario);
      if (c.tokens !== null) {
        fs.writeFileSync(path.join(fixture.homeDir, '.outlook-skills', 'tokens.json'), c.tokens);
      }
      const serverPath = path.join(fixture.pluginDir, 'outlook-skills', 'auth-server.js');
      const result = spawnSync(process.execPath, [serverPath, ...c.args],
        { env: fixture.env, encoding: 'utf8', timeout: 10000 });

      assert.strictEqual(result.status, 0, `${c.name}: exit ${result.status}: ${result.stderr}`);
      const expectedCmd = getExpectedAuthCmd(path.join(fixture.pluginDir, 'outlook-skills'), 'reauth');
      assert.ok(result.stdout.includes(expectedCmd), `${c.name}: expected "${expectedCmd}" in: ${result.stdout}`);
      if (c.name === 'corrupt token store') {
        // The corrupt-store message is a no-credentials message, so it must list
        // the checked directories, like the no-token case does.
        const homeStateDir = path.join(fixture.homeDir, '.outlook-skills');
        assert.ok(
          result.stdout.includes(`Token store is unreadable/corrupt. Checked: ${homeStateDir}. Run: ${expectedCmd}`),
          `${c.name}: expected the exact corrupt-store message in: ${result.stdout}`
        );
      }
      for (const secret of FIXTURE_SECRETS) {
        assert.ok(!result.stdout.includes(secret), `${c.name}: secret "${secret}" printed`);
      }
    } finally {
      if (fixture) fixture.cleanup();
    }
  }
});

// ── Test: leading ~ expands to the home directory, as in token_helper.py ────
test('leading ~ in OUTLOOK_SKILLS_HOME and OUTLOOK_TOKEN_FILE expands to home', () => {
  const scenario = {
    id: 994,
    env: {},
    home: [],
    plugin: [],
    windows_only: false,
    expected_state_dir: 'home',
    expected_token_file: 'state_dir',
    expected_checked_dirs: ['home', 'plugin'],
  };

  let fixture = null;
  try {
    fixture = buildFixture(scenario);
    const homeVar = process.platform === 'win32' ? 'USERPROFILE' : 'HOME';
    const homeBase = fixture.env[homeVar];

    const env = {
      ...fixture.env,
      OUTLOOK_SKILLS_HOME: '~/custom-state',
      OUTLOOK_TOKEN_FILE: '~/custom-tokens.json',
    };
    const result = runWhere(fixture.pluginDir, env);

    const expectedStateDir = path.join(homeBase, 'custom-state');
    assert.strictEqual(result.state_dir, expectedStateDir);
    assert.strictEqual(result.token_file, path.join(homeBase, 'custom-tokens.json'));
    assert.deepStrictEqual(result.checked_dirs, [expectedStateDir]);
  } finally {
    if (fixture) {
      fixture.cleanup();
    }
  }
});
