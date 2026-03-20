const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');

// Skip all integration tests unless explicitly enabled
const ENABLED = process.env.OUTLOOK_INTEGRATION_TEST === 'true';

describe('Integration smoke tests', { skip: !ENABLED ? 'Set OUTLOOK_INTEGRATION_TEST=true to run' : false }, () => {
  function graphCall(method, endpoint) {
    const result = execSync(
      `python3 scripts/graph_call.py ${method} "${endpoint}"`,
      { encoding: 'utf8', timeout: 15000 }
    );
    return JSON.parse(result.trim());
  }

  it('should get current user profile', () => {
    const response = graphCall('GET', '/me');
    assert.strictEqual(response.status, 200, `Expected 200, got ${response.status}`);
    assert.ok(response.data && response.data.displayName, 'displayName should be present');
  });

  it('should get messages', () => {
    const response = graphCall('GET', '/me/messages?$top=1&$select=id,subject');
    assert.strictEqual(response.status, 200);
    assert.ok(response.data && Array.isArray(response.data.value), 'Response should contain value array');
  });

  it('should get calendar events', () => {
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const response = graphCall('GET', `/me/calendarView?startDateTime=${now}&endDateTime=${tomorrow}&$top=1&$select=id,subject`);
    assert.strictEqual(response.status, 200);
    assert.ok(response.data && Array.isArray(response.data.value), 'Response should contain value array');
  });

  it('should get contacts', () => {
    const response = graphCall('GET', '/me/contacts?$top=1&$select=id,displayName');
    assert.strictEqual(response.status, 200);
    assert.ok(response.data && Array.isArray(response.data.value), 'Response should contain value array');
  });

  it('should get mail folders', () => {
    const response = graphCall('GET', '/me/mailFolders?$top=5');
    assert.strictEqual(response.status, 200);
    assert.ok(response.data && Array.isArray(response.data.value), 'Response should contain value array');
  });
});
