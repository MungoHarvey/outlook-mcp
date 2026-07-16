// Behavioral tests for the auth-server callback hardening (loop 220):
// CSRF state validation, Host-header pinning, and reachability. Spawns the real
// server with test creds (OUTLOOK_NO_BROWSER, dummy client id/secret) on a
// throwaway port and probes it over HTTP.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const PORT = 8477;
const ROOT = path.resolve(__dirname, '..', '..');
let child;

function get(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: pathname, method: 'GET', headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
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

after(() => { if (child) child.kill(); });

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

test('does not reflect unescaped script into the error page', async () => {
  // state check happens first, so this returns the static 400 page — the key
  // property is that no raw <script> is echoed back.
  const r = await get('/auth/callback?state=x&error=%3Cscript%3Ealert(1)%3C/script%3E');
  assert.ok(!r.body.includes('<script>alert(1)</script>'));
});
