// DEPRECATED: This test covers scripts/outlook-auth-server.js which has been
// superseded by outlook-skills/auth.sh (Python OAuth flow).
// The underlying script is retained for reference only; this test is kept
// to prevent regressions in the deprecated script.

const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// We test the auth server by spawning it as a child process or importing it
// Since the script has side effects at top level, we test its core logic
// by importing it after the require.main guard is added

describe('Auth server', () => {
  let server;
  let PORT;
  let TOKEN_PATH;
  let originalEnv;

  before(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Set test env vars
    TOKEN_PATH = path.join(os.tmpdir(), `.outlook-test-tokens-${Date.now()}.json`);
    process.env.OUTLOOK_CLIENT_ID = 'test-client-id';
    process.env.OUTLOOK_CLIENT_SECRET = 'test-client-secret';
    process.env.OUTLOOK_TENANT_ID = 'test-tenant';

    // Import the module (requires the require.main guard)
    const authModule = require('../../scripts/outlook-auth-server.js');
    server = authModule.server;
    PORT = authModule.PORT;

    // Override TOKEN_PATH for tests if the module exports it
    if (authModule.TOKEN_PATH) {
      // We can't easily override const, but we can test the server behavior
    }
  });

  after(() => {
    // Restore env
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) delete process.env[key];
    });
    Object.assign(process.env, originalEnv);

    // Clean up temp token file
    try { fs.unlinkSync(TOKEN_PATH); } catch {}

    // Close server if running
    if (server && server.listening) {
      server.close();
    }
  });

  it('should export server and PORT', () => {
    assert.ok(server, 'Should export server');
    assert.strictEqual(typeof PORT, 'number', 'PORT should be a number');
    assert.strictEqual(PORT, 3333, 'Default port should be 3333');
  });

  it('should export exchangeCodeForTokens function', () => {
    const authModule = require('../../scripts/outlook-auth-server.js');
    assert.strictEqual(typeof authModule.exchangeCodeForTokens, 'function',
      'Should export exchangeCodeForTokens');
  });

  it('server should be an HTTP server instance', () => {
    assert.ok(server instanceof http.Server, 'Should be an http.Server instance');
  });
});
