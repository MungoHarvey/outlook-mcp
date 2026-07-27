// Behavioral tests for the auth-server callback hardening (loop 220):
// CSRF state validation, Host-header pinning, and reachability. Spawns the real
// server with test creds (OUTLOOK_NO_BROWSER, dummy client id/secret) on a
// throwaway port and probes it over HTTP.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PORT = 8477;
const ROOT = path.resolve(__dirname, '..', '..');
// Isolated state dir: without this, a developer's real outlook-skills/.env
// would win over the test env vars (.env takes precedence by design) and the
// server would bind their configured port instead of PORT.
const STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'outlook-auth-test-'));
let child;

function get(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: pathname, method: 'GET', headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  child = spawn(process.execPath, ['outlook-skills/auth-server.js', '--reauth'], {
    cwd: ROOT,
    env: {
      ...process.env,
      OUTLOOK_SKILLS_HOME: STATE_DIR,
      OUTLOOK_NO_BROWSER: '1',
      OUTLOOK_AUTH_PORT: String(PORT),
      OUTLOOK_CLIENT_ID: 'test-client-id',
      OUTLOOK_CLIENT_SECRET: 'test-client-secret',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await get('/'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('auth-server did not start listening');
});

after(() => {
  if (child) child.kill();
  fs.rmSync(STATE_DIR, { recursive: true, force: true });
});

test('serves root instructions on loopback', async () => {
  const r = await get('/');
  assert.strictEqual(r.status, 200);
});

test('rejects non-loopback Host header (DNS-rebinding guard)', async () => {
  const r = await get('/auth/callback?state=anything', { Host: 'evil.example.com' });
  assert.strictEqual(r.status, 403);
});

test('rejects callback with mismatched/absent state (CSRF guard)', async () => {
  const r = await get('/auth/callback?state=not-the-real-state&code=abc');
  assert.strictEqual(r.status, 400);
  assert.match(r.body, /state/i);
});

// NOTE: keep this LAST — a state-valid callback error hits the query.error
// branch, which shuts the server down.
test('HTML-escapes reflected error content on a state-valid callback', async () => {
  // Obtain a real state via /auth (302 with state in the Location) so the
  // callback passes the state check and actually reaches the escaping path.
  const authResp = await get('/auth');
  assert.strictEqual(authResp.status, 302);
  const state = new URL(authResp.headers.location).searchParams.get('state');
  assert.ok(state, 'expected a state parameter in the /auth redirect');

  const r = await get(
    `/auth/callback?state=${state}&error=${encodeURIComponent('<script>alert(1)</script>')}`
  );
  assert.ok(!r.body.includes('<script>alert(1)</script>'),
    'reflected error content must be HTML-escaped');
  assert.match(r.body, /&lt;script&gt;/,
    'the error WAS reflected (escaped), proving the escaping path ran');
});
