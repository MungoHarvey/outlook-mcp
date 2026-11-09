// Tests for MCP message propagation (auth.js, graph.js, index.js).
// Runs modules as subprocesses with fixture environment — never imports directly.

import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, copyFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { platform, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const IS_WIN = platform() === 'win32';
const FAKE_SECRET = 'fake-secret-for-tests';

// Allowlist of files to copy for the fixture
const ALLOWLIST = [
  'mcp-server/src/auth.js',
  'mcp-server/src/graph.js',
  'mcp-server/src/index.js',
  'mcp-server/package.json',
  'outlook-skills/scopes.json',
  'outlook-skills/auth.sh',
  'outlook-skills/auth.ps1',
];

function buildMcpFixture() {
  const pluginDir = mkdtempSync(join(tmpdir(), 'outlook-mcp-fixture-'));
  const homeDir = mkdtempSync(join(tmpdir(), 'outlook-mcp-home-'));

  try {
    for (const relPath of ALLOWLIST) {
      const src = join(REPO_ROOT, relPath);
      if (!existsSync(src)) throw new Error(`Allowlisted file not found: ${src}`);
      const dst = join(pluginDir, relPath);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
    }

    // Build environment for subprocess (no inherited OUTLOOK_* vars)
    const env = { ...process.env };
    delete env.OUTLOOK_CLIENT_ID;
    delete env.OUTLOOK_CLIENT_SECRET;
    delete env.OUTLOOK_SKILLS_HOME;
    delete env.OUTLOOK_TOKEN_FILE;
    env.HOME = homeDir;
    env.USERPROFILE = homeDir;

    return { pluginDir, homeDir, env, cleanup: () => cleanupFixture(pluginDir, homeDir) };
  } catch (e) {
    cleanupFixture(pluginDir, homeDir);
    throw e;
  }
}

function cleanupFixture(pluginDir, homeDir) {
  try { rmSync(pluginDir, { recursive: true, force: true }); } catch {}
  try { rmSync(homeDir, { recursive: true, force: true }); } catch {}
}

// Expected platform-correct reauth command, as the fixture lays it out.
function expectedReauthCommand(pluginDir) {
  const skillsDir = join(pluginDir, 'outlook-skills');
  return IS_WIN
    ? `powershell -NoProfile -File "${join(skillsDir, 'auth.ps1')}" -Reauth`
    : `bash "${join(skillsDir, 'auth.sh')}" --reauth`;
}

// Write a probe module into the fixture and run it. The probe prints one JSON
// object. `.mjs` makes it ESM regardless of any package.json lookup.
function runProbe(fixture, code) {
  const script = join(fixture.pluginDir, `probe_${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(script, code);
  const result = spawnSync(process.execPath, [script], {
    env: fixture.env,
    cwd: fixture.pluginDir,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.status, 0, `probe failed: ${result.stderr}`);
  assert.ok(result.stdout.length > 0, `probe printed nothing. stderr: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

test('auth.js exports authCommand function', () => {
  const fixture = buildMcpFixture();
  try {
    const authPath = join(fixture.pluginDir, 'mcp-server', 'src', 'auth.js');
    const source = readFileSync(authPath, 'utf8');

    // Should export authCommand
    assert.ok(
      source.includes('export function authCommand') ||
      source.includes('export { authCommand }'),
      'auth.js should export authCommand function'
    );

    // Should have -NoProfile on Windows
    assert.ok(
      source.includes('-NoProfile'),
      'auth.js should use -NoProfile for PowerShell'
    );
  } finally {
    fixture.cleanup();
  }
});

test('auth.js authCommand returns platform-correct command', () => {
  const fixture = buildMcpFixture();
  try {
    const result = runProbe(fixture, `
      import { authCommand, resolveStateDir } from './mcp-server/src/auth.js';
      const state = resolveStateDir();
      console.log(JSON.stringify({ command: authCommand('reauth'), checked_dirs: state.checked_dirs }));
    `);
    const cmd = result.command;

    if (IS_WIN) {
      assert.ok(cmd.includes('powershell -NoProfile -File'),
        `Windows command should include '-NoProfile'. Got: ${cmd}`);
      assert.ok(cmd.includes('auth.ps1'),
        `Windows command should reference 'auth.ps1'. Got: ${cmd}`);
      assert.ok(cmd.includes('-Reauth'),
        `Windows command should include '-Reauth'. Got: ${cmd}`);
    } else {
      assert.ok(cmd.includes('bash "'),
        `Unix command should include 'bash "'. Got: ${cmd}`);
      assert.ok(cmd.includes('auth.sh'),
        `Unix command should reference 'auth.sh'. Got: ${cmd}`);
      assert.ok(cmd.includes('--reauth'),
        `Unix command should include '--reauth'. Got: ${cmd}`);
    }
    assert.strictEqual(cmd, expectedReauthCommand(fixture.pluginDir));
  } finally {
    fixture.cleanup();
  }
});

test('graph.js imports and uses authCommand', () => {
  const fixture = buildMcpFixture();
  try {
    const graphPath = join(fixture.pluginDir, 'mcp-server', 'src', 'graph.js');
    const source = readFileSync(graphPath, 'utf8');

    // Should import authCommand from auth.js
    assert.ok(
      source.includes('authCommand') && source.includes('./auth.js'),
      'graph.js should import authCommand from auth.js'
    );

    // Should NOT have hardcoded relative path message
    assert.ok(
      !source.includes('.\\\\outlook-skills\\\\auth.ps1') &&
      !source.includes('./outlook-skills/auth.ps1') &&
      !source.includes('.\\outlook-skills\\auth.ps1'),
      'graph.js should not have hardcoded relative auth path'
    );
  } finally {
    fixture.cleanup();
  }
});

test('graph.js second-401 message contains checked dirs and absolute command', () => {
  const fixture = buildMcpFixture();
  try {
    // An unexpired access token, so getToken() returns it without a refresh and
    // both 401s come from the stubbed Graph call. An expired token would stop at
    // the refresh's "client_secret not found" error and never reach the second-401
    // path, which is what this test is about.
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');
    mkdirSync(homeStateDir, { recursive: true });
    const validTokens = {
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      client_id: 'fake-client',
      session_started_at: Math.floor(Date.now() / 1000) - 1000,
      access_token_expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    writeFileSync(
      join(homeStateDir, 'tokens.json'),
      JSON.stringify(validTokens, null, 2)
    );

    const output = runProbe(fixture, `
      import { makeRequest } from './mcp-server/src/graph.js';

      // Stub fetch to return 401 twice (triggering the second-401 path)
      globalThis.fetch = async () => ({
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
        text: async () => '{"error":"invalid_token"}',
        json: async () => ({ error: 'invalid_token' }),
      });

      const result = await makeRequest('GET', '/me', null, {});
      console.log(JSON.stringify(result));
    `);

    assert.strictEqual(output.status, 401, 'Should return 401 status');
    assert.strictEqual(output.error, 'auth_required', 'Should have auth_required error');
    assert.strictEqual(
      output.message,
      `Token rejected after refresh. Checked: ${homeStateDir}. Run: ${expectedReauthCommand(fixture.pluginDir)}`
    );
  } finally {
    fixture.cleanup();
  }
});

test('getSessionInfo + authStatusText: no token file gives the resolver message', () => {
  const fixture = buildMcpFixture();
  try {
    const out = runProbe(fixture, `
      import { getSessionInfo, authStatusText } from './mcp-server/src/auth.js';
      const info = await getSessionInfo();
      console.log(JSON.stringify({ info, text: authStatusText(info) }));
    `);

    assert.strictEqual(out.info.authenticated, false);
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');
    const skillsDir = join(fixture.pluginDir, 'outlook-skills');
    const expected =
      `No token file found. Checked: ${homeStateDir}; ${skillsDir}. ` +
      `Run: ${expectedReauthCommand(fixture.pluginDir)}`;
    assert.strictEqual(out.info.message, expected, 'getSessionInfo should carry the resolver message');
    assert.strictEqual(out.text, expected, 'authStatusText should return the resolver message');
  } finally {
    fixture.cleanup();
  }
});

test('authStatusText: authenticated session returns the status summary', () => {
  const fixture = buildMcpFixture();
  try {
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');
    mkdirSync(homeStateDir, { recursive: true });
    writeFileSync(join(homeStateDir, 'tokens.json'), JSON.stringify({
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      user_email: 'user@example.test',
      session_started_at: Math.floor(Date.now() / 1000) - 1000,
      access_token_expires_at: Math.floor(Date.now() / 1000) + 3600,
    }));

    const out = runProbe(fixture, `
      import { getSessionInfo, authStatusText } from './mcp-server/src/auth.js';
      const info = await getSessionInfo();
      console.log(JSON.stringify({ text: authStatusText(info) }));
    `);

    const summary = JSON.parse(out.text);
    assert.strictEqual(summary.authenticated, true);
    assert.strictEqual(summary.user_email, 'user@example.test');
    assert.ok(!out.text.includes('fake-access-token'), 'status text must not expose the access token');
  } finally {
    fixture.cleanup();
  }
});

test('login path: a failed refresh gives the refresh text, not the generic error', () => {
  const fixture = buildMcpFixture();
  try {
    // Expired access token, so getToken() refreshes. The secret comes from the
    // state dir's .env, and fetch fails as a network outage.
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');
    mkdirSync(homeStateDir, { recursive: true });
    writeFileSync(join(homeStateDir, 'tokens.json'), JSON.stringify({
      access_token: 'fake-expired-access-token',
      refresh_token: 'fake-refresh-token',
      client_id: 'fake-client',
      tenant_id: 'common',
      session_started_at: Math.floor(Date.now() / 1000) - 1000,
      access_token_expires_at: Math.floor(Date.now() / 1000) - 1000,
    }));
    writeFileSync(join(homeStateDir, '.env'), `OUTLOOK_CLIENT_SECRET=${FAKE_SECRET}\n`);

    const out = runProbe(fixture, `
      import { getToken, authStatusText } from './mcp-server/src/auth.js';
      globalThis.fetch = async () => { throw new TypeError('simulated outage'); };
      let text;
      try {
        await getToken();
        text = 'NO ERROR';
      } catch (err) {
        text = authStatusText(err);
      }
      console.log(JSON.stringify({ text }));
    `);

    const expected =
      'Sign-in could not be refreshed (network or service error): ' +
      'Network error during token refresh: simulated outage. ' +
      `Retry, or run: ${expectedReauthCommand(fixture.pluginDir)}`;
    assert.strictEqual(out.text, expected);
    assert.ok(!out.text.includes(FAKE_SECRET), 'refresh text must not contain the client secret');
  } finally {
    fixture.cleanup();
  }
});

test('status path: an unrelated error is reported as itself, not as not-signed-in', () => {
  const fixture = buildMcpFixture();
  try {
    // tokens.json holding JSON null makes the session check throw a TypeError.
    // That is not an auth problem, so it must surface as itself.
    const homeStateDir = join(fixture.homeDir, '.outlook-skills');
    mkdirSync(homeStateDir, { recursive: true });
    writeFileSync(join(homeStateDir, 'tokens.json'), 'null');

    const out = runProbe(fixture, `
      import { getSessionInfo, authStatusText } from './mcp-server/src/auth.js';
      let text;
      try {
        text = authStatusText(await getSessionInfo());
      } catch (err) {
        text = authStatusText(err);
      }
      console.log(JSON.stringify({ text }));
    `);

    assert.ok(out.text.startsWith('Could not check sign-in status: '),
      `Expected a 'Could not check sign-in status:' reply. Got: ${out.text}`);
    assert.ok(!out.text.includes('No token file'),
      `An unrelated error must not look like a missing sign-in. Got: ${out.text}`);
  } finally {
    fixture.cleanup();
  }
});

test('index.js routes status and login through authStatusText', () => {
  const fixture = buildMcpFixture();
  try {
    // index.js cannot run without the MCP SDK, so this only checks that it
    // calls the tested message builder and has no hard-coded relative paths.
    const indexPath = join(fixture.pluginDir, 'mcp-server', 'src', 'index.js');
    const source = readFileSync(indexPath, 'utf8');

    assert.ok(source.includes('authStatusText('), 'index.js should build replies with authStatusText');
    assert.ok(
      !source.includes('.\\\\outlook-skills\\\\auth.ps1') &&
      !source.includes('./outlook-skills/auth.ps1') &&
      !source.includes('.\\outlook-skills\\auth.ps1'),
      'index.js should not have hardcoded relative auth paths'
    );
  } finally {
    fixture.cleanup();
  }
});
