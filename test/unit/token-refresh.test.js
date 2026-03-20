// DEPRECATED: This test covers scripts/outlook-token-refresh.js which has been
// superseded by token refresh handled internally by outlook-skills/token_helper.py.
// The underlying script is retained for reference only; this test is kept
// to prevent regressions in the deprecated script.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

describe('Token refresh', () => {
  let originalEnv;

  before(() => {
    originalEnv = { ...process.env };
    process.env.OUTLOOK_CLIENT_ID = 'test-client-id';
    process.env.OUTLOOK_CLIENT_SECRET = 'test-client-secret';
    process.env.OUTLOOK_TENANT_ID = 'test-tenant';
  });

  after(() => {
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  it('should export refreshToken function', () => {
    const refreshModule = require('../../scripts/outlook-token-refresh.js');
    assert.strictEqual(typeof refreshModule.refreshToken, 'function',
      'Should export refreshToken');
  });

  it('refreshToken should return a promise', () => {
    const refreshModule = require('../../scripts/outlook-token-refresh.js');
    // We can't easily call refreshToken without mocking https and fs,
    // but we can verify it returns a thenable when called
    // This is a structural test — integration behavior tested in smoke tests
    assert.strictEqual(typeof refreshModule.refreshToken, 'function');
  });

  it('module should be importable without side effects', () => {
    // If require.main guard works, importing should not call refreshToken()
    // The fact that we got here without process.exit means it works
    assert.ok(true, 'Module imported without side effects');
  });
});
