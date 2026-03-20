#!/usr/bin/env node
// DEPRECATED: This Node.js OAuth server has been replaced by outlook-skills/auth.sh (Python).
// This file is retained for reference only. Do not use in new workflows.
//
/**
 * Slim OAuth Authentication Server for Outlook
 *
 * Starts a local HTTP server on port 3333 to handle the OAuth 2.0
 * authorization code flow with Microsoft Identity Platform.
 *
 * Usage: node scripts/outlook-auth-server.js
 */
const http = require('http');
const url = require('url');
const https = require('https');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = 3333;
const TOKEN_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.outlook-mcp-tokens.json');
const TENANT_ID = process.env.MS_TENANT_ID || process.env.OUTLOOK_TENANT_ID || 'common';
const CLIENT_ID = process.env.MS_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const SCOPES = [
  'offline_access', 'User.Read', 'Mail.Read', 'Mail.ReadWrite',
  'Mail.Send', 'Calendars.Read', 'Calendars.ReadWrite', 'Contacts.Read'
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: Set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET in .env');
  process.exit(1);
}

function exchangeCodeForTokens(code) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: SCOPES.join(' ')
    });

    const req = https.request(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const tokens = JSON.parse(data);
              tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
              fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf8');
              resolve(tokens);
            } catch (e) {
              reject(new Error(`Failed to parse token response: ${e.message}`));
            }
          } else {
            reject(new Error(`Token exchange failed (${res.statusCode}): ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/auth/callback') {
    if (parsed.query.error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error</h1><p>${parsed.query.error}: ${parsed.query.error_description || ''}</p>`);
      return;
    }
    if (parsed.query.code) {
      exchangeCodeForTokens(parsed.query.code)
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authenticated!</h1><p>Tokens saved. You can close this window and return to Claude.</p>');
          console.log('Authentication successful. Tokens saved to ' + TOKEN_PATH);
          setTimeout(() => process.exit(0), 2000);
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<h1>Token Exchange Error</h1><p>${err.message}</p>`);
        });
    } else {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Missing authorization code</h1>');
    }
  } else if (parsed.pathname === '/auth') {
    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
      querystring.stringify({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES.join(' '),
        response_mode: 'query',
        state: Date.now().toString()
      });
    res.writeHead(302, { Location: authUrl });
    res.end();
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Outlook Auth Server running. Visit /auth to start authentication.');
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    const authUrl = `http://localhost:${PORT}/auth`;
    console.log(`Auth server running at http://localhost:${PORT}`);
    console.log(`Open this URL to authenticate: ${authUrl}`);
    console.log(`Tokens will be saved to: ${TOKEN_PATH}`);
  });

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

module.exports = { exchangeCodeForTokens, server, PORT, TOKEN_PATH };
