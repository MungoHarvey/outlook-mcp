#!/usr/bin/env node
/**
 * outlook-skills/auth-server.js
 *
 * Minimal OAuth 2.0 auth server — mirrors the proven MCP approach exactly.
 * Starts an HTTP server, redirects to Microsoft login, catches the callback,
 * exchanges code for tokens, and saves them to tokens.json.
 *
 * Usage:
 *   node outlook-skills/auth-server.js            # start auth flow
 *   node outlook-skills/auth-server.js --status   # check token status
 *   node outlook-skills/auth-server.js --reauth   # force new login
 *   node outlook-skills/auth-server.js --revoke   # delete stored tokens
 *
 * Credentials: outlook-skills/.env (OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET)
 */

const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Load .env manually (no dependencies needed) ────────────────────────────
const SCRIPT_DIR = __dirname;
const ENV_FILE = path.join(SCRIPT_DIR, '.env');
const TOKEN_FILE = path.join(SCRIPT_DIR, 'tokens.json');

function loadEnv() {
  // Missing .env is not fatal here — process.env is used as a fallback below,
  // and the credential check further down gives a clear error if both are empty.
  const env = {};
  if (!fs.existsSync(ENV_FILE)) return env;
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    // Strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();

const CLIENT_ID     = env.OUTLOOK_CLIENT_ID     || process.env.OUTLOOK_CLIENT_ID     || '';
const CLIENT_SECRET = env.OUTLOOK_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET || '';
const TENANT_ID     = env.OUTLOOK_TENANT_ID     || process.env.OUTLOOK_TENANT_ID     || 'common';
const PORT          = parseInt(env.OUTLOOK_AUTH_PORT || process.env.OUTLOOK_AUTH_PORT || '8400', 10);
const REDIRECT_URI  = env.OUTLOOK_REDIRECT_URI  || process.env.OUTLOOK_REDIRECT_URI  || `http://localhost:${PORT}/auth/callback`;

// Canonical scope list — single source of truth in outlook-skills/scopes.json.
// Keep the permission tables in setup/ and skills/outlook-auth in sync with it.
// Includes OpenID Connect scopes (openid/profile/email) so the token response
// carries an id_token (used to record user_email in tokens.json).
const SCOPES = JSON.parse(
  fs.readFileSync(path.join(SCRIPT_DIR, 'scopes.json'), 'utf8')
).scopes;

// Restrict the token file to the current user (best-effort; non-fatal).
function hardenPerms(file) {
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      const user = process.env.USERNAME || process.env.USER || '';
      if (user) {
        execSync(`icacls "${file}" /inheritance:r /grant:r "${user}:(R,W)"`, { stdio: 'ignore' });
      }
    } else {
      fs.chmodSync(file, 0o600);
    }
  } catch (e) { /* non-fatal — file still usable */ }
}

// ── CLI flags ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isStatus = args.includes('--status');
const isReauth = args.includes('--reauth');
const isRevoke = args.includes('--revoke');

// ── Revoke — delete stored tokens ───────────────────────────────────────────
if (isRevoke) {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
    console.log(`\n  Tokens revoked and deleted: ${TOKEN_FILE}`);
    console.log('  Run auth again to re-authenticate.\n');
  } else {
    console.log('\n  No tokens to revoke (already signed out).\n');
  }
  process.exit(0);
}

// ── Status check ────────────────────────────────────────────────────────────
if (isStatus) {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.log('\n  Not authenticated. Run: node outlook-skills/auth-server.js\n');
    process.exit(0);
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  const now = Date.now() / 1000;
  const sessionAge = now - (tokens.session_started_at || 0);
  const daysUsed = Math.floor(sessionAge / 86400);
  const daysLeft = Math.max(0, 30 - daysUsed);
  const tokenOk = now < (tokens.access_token_expires_at || 0);

  console.log(`\n  User:          ${tokens.user_email || 'unknown'}`);
  console.log(`  Session age:   ${daysUsed} days used, ~${daysLeft} days remaining`);
  console.log(`  Access token:  ${tokenOk ? 'valid' : 'expired (will auto-refresh)'}`);
  console.log(`  Scopes:        ${(tokens.scopes || []).join(', ')}`);

  // Scope-drift check — warn if the stored grant predates a scope addition.
  const oidc = ['openid', 'profile', 'email', 'offline_access'];
  const granted = (tokens.scopes || []).map(s => s.toLowerCase());
  const missing = SCOPES
    .filter(s => !oidc.includes(s))
    .filter(r => !granted.some(g => g === r.toLowerCase() || g.endsWith('/' + r.toLowerCase())));
  if (missing.length) {
    console.log(`  [!] Missing:   ${missing.join(', ')}`);
    console.log('               Run --reauth to grant the new permissions.');
  }

  console.log(`  Token file:    ${TOKEN_FILE}\n`);
  process.exit(0);
}

// ── Validate credentials ────────────────────────────────────────────────────
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('[error] OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET must be set in outlook-skills/.env');
  process.exit(1);
}

// ── Check existing session (skip if --reauth) ───────────────────────────────
if (!isReauth && fs.existsSync(TOKEN_FILE)) {
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    const age = Date.now() / 1000 - (tokens.session_started_at || 0);
    if (age < 30 * 24 * 60 * 60) {
      const daysLeft = Math.floor((30 * 24 * 60 * 60 - age) / 86400);
      console.log(`\n  Already authenticated as ${tokens.user_email || 'unknown'}`);
      console.log(`  Session valid for ~${daysLeft} more days.`);
      console.log('  Use --reauth to force a new login.\n');
      process.exit(0);
    }
  } catch (e) { /* corrupted file, proceed with auth */ }
}

// ── Token exchange (server-side HTTPS POST — same as MCP) ───────────────────
function exchangeCodeForTokens(code) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: SCOPES.join(' ')
    });

    const options = {
      hostname: 'login.microsoftonline.com',
      path: `/${TENANT_ID}/oauth2/v2.0/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse token response: ${e.message}`));
          }
        } else {
          reject(new Error(`Token exchange failed (${res.statusCode}): ${data}`));
        }
      });
    });

    req.setTimeout(30000, () => {
      req.destroy(new Error('Token exchange timed out after 30s'));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ── HTML-escape values interpolated into callback pages (reflected-XSS guard) ─
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Only accept requests whose Host is loopback (defeats DNS-rebinding at :PORT).
function isLocalHost(req) {
  const host = (req.headers.host || '').toLowerCase();
  return host === `localhost:${PORT}`
      || host === `127.0.0.1:${PORT}`
      || host === `[::1]:${PORT}`;
}

// Single-use CSRF state, set at /auth and verified at /auth/callback.
let authState = null;

// ── Decode email from id_token JWT (no verification needed) ─────────────────
function decodeEmail(idToken) {
  if (!idToken) return 'unknown';
  try {
    const payload = idToken.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return decoded.email || decoded.upn || decoded.preferred_username || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

// ── HTTP Server — same 302 redirect pattern as MCP auth server ──────────────
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // ── Loopback-only: reject cross-origin / DNS-rebinding hits on auth routes ─
  if ((pathname === '/auth' || pathname === '/auth/callback') && !isLocalHost(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // ── /auth → 302 redirect to Microsoft (matches MCP server exactly) ────────
  if (pathname === '/auth') {
    authState = crypto.randomBytes(32).toString('hex');
    const authParams = {
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES.join(' '),
      response_mode: 'query',
      state: authState
    };

    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${querystring.stringify(authParams)}`;
    console.log('  Redirecting to Microsoft login...');

    res.writeHead(302, { 'Location': authUrl });
    res.end();
    return;
  }

  // ── /auth/callback → exchange code for tokens ─────────────────────────────
  if (pathname === '/auth/callback') {
    const query = parsedUrl.query;

    // ── Single-use CSRF state check — reject any callback we didn't start ────
    // Do NOT shut down on mismatch: a stray/drive-by request must not be able
    // to kill an in-flight legitimate login. Just reject and keep listening.
    if (!authState || query.state !== authState) {
      console.error('\n  [error] Auth callback rejected: state parameter mismatch');
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Authentication failed</h2><p>Invalid or missing state parameter.</p></body></html>');
      return;
    }
    authState = null;  // consume — single use

    if (query.error) {
      console.error(`\n  [error] Auth failed: ${query.error}`);
      console.error(`          ${query.error_description || ''}`);
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h2>Authentication failed</h2><p>${escapeHtml(query.error)}: ${escapeHtml(query.error_description || '')}</p><p>Check the terminal for details.</p></body></html>`);
      shutdownServer();
      return;
    }

    if (query.code) {
      console.log('  Authorization code received. Exchanging for tokens...');

      exchangeCodeForTokens(query.code)
        .then((tokenResponse) => {
          const email = decodeEmail(tokenResponse.id_token);
          const now = Date.now() / 1000;

          // Save in the format token_helper.py expects. The client secret is
          // NOT persisted — refresh reads it from outlook-skills/.env, so a
          // leaked tokens.json can't also leak the long-lived app secret.
          const tokens = {
            access_token:            tokenResponse.access_token,
            refresh_token:           tokenResponse.refresh_token,
            access_token_expires_at: now + (tokenResponse.expires_in || 3600) - 60,
            session_started_at:      now,
            scopes:                  (tokenResponse.scope || '').split(' '),
            user_email:              email,
            tenant_id:               TENANT_ID,
            client_id:               CLIENT_ID,
          };

          fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { encoding: 'utf8', mode: 0o600 });
          hardenPerms(TOKEN_FILE);

          console.log(`\n  Authenticated as: ${email}`);
          console.log(`  Scopes granted: ${tokens.scopes.join(', ')}`);
          console.log(`  Tokens stored at: ${TOKEN_FILE}`);
          console.log('  Session will expire in 30 days.\n');

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h2>Authentication successful!</h2><p>Signed in as ${escapeHtml(email)}.</p><p>You can close this tab and return to Claude.</p></body></html>`);
          shutdownServer();
        })
        .catch((error) => {
          console.error(`\n  [error] Token exchange failed: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h2>Token exchange failed</h2><p>${escapeHtml(error.message)}</p></body></html>`);
          shutdownServer();
        });
      return;
    }
  }

  // ── Root — instructions ───────────────────────────────────────────────────
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body><h2>Outlook Skills Auth Server</h2><p>Navigate to <a href="/auth">/auth</a> to start authentication.</p></body></html>`);
    return;
  }

  res.writeHead(404);
  res.end();
});

function shutdownServer() {
  setTimeout(() => {
    server.close();
    process.exit(0);
  }, 1000);
}

// ── Start server and open browser ───────────────────────────────────────────
server.listen(PORT, () => {
  // Overall deadline — never leave an auth-capable server listening forever if
  // the user abandons the login.
  setTimeout(() => {
    console.error('\n  [error] Auth timed out (no callback within 10 minutes). Shutting down.');
    server.close();
    process.exit(1);
  }, 10 * 60 * 1000).unref();

  const authPageUrl = `http://localhost:${PORT}/auth`;
  console.log(`\n  Auth server running at http://localhost:${PORT}`);
  console.log(`  Redirect URI: ${REDIRECT_URI}`);
  console.log(`  Scopes: ${SCOPES.join(', ')}`);
  console.log(`\n  Opening browser to: ${authPageUrl}`);
  console.log('  If the browser does not open, navigate to the URL above manually.\n');

  // Open browser — cross-platform (skippable for automated tests)
  if (process.env.OUTLOOK_NO_BROWSER) return;
  const { exec } = require('child_process');
  const openCmd = process.platform === 'win32' ? `start "" "${authPageUrl}"`
                : process.platform === 'darwin' ? `open "${authPageUrl}"`
                : `xdg-open "${authPageUrl}"`;
  exec(openCmd, (err) => {
    if (err) console.log('  [warn] Could not open browser automatically. Please navigate manually.');
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  [error] Port ${PORT} is already in use. Is another auth process running?`);
  } else {
    console.error(`\n  [error] ${err.message}`);
  }
  process.exit(1);
});
