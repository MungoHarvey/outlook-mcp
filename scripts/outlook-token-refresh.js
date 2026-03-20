#!/usr/bin/env node
// DEPRECATED: Token refresh is now handled internally by outlook-skills/token_helper.py via graph_call.py.
// This file is retained for reference only. Do not use in new workflows.
//
/**
 * Outlook Token Refresh Script
 * Reads refresh_token from ~/.outlook-mcp-tokens.json,
 * exchanges it for a new access_token, and writes back.
 */
const fs = require('fs');
const https = require('https');
const path = require('path');
const querystring = require('querystring');

// Load .env from project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TOKEN_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.outlook-mcp-tokens.json');
const TENANT_ID = process.env.MS_TENANT_ID || process.env.OUTLOOK_TENANT_ID || 'common';
const CLIENT_ID = process.env.MS_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET;
const SCOPES = [
  'offline_access', 'User.Read', 'Mail.Read', 'Mail.ReadWrite',
  'Mail.Send', 'Calendars.Read', 'Calendars.ReadWrite', 'Contacts.Read'
];

async function refreshToken() {
  // Read existing tokens
  let tokens;
  try {
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  } catch (err) {
    console.error('ERROR: Cannot read token file at', TOKEN_PATH);
    console.error('Run /outlook-auth to authenticate first.');
    process.exit(1);
  }

  if (!tokens.refresh_token) {
    console.error('ERROR: No refresh_token found. Re-authenticate with /outlook-auth.');
    process.exit(1);
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('ERROR: OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  const postData = querystring.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    scope: SCOPES.join(' ')
  });

  const tokenEndpoint = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  return new Promise((resolve, reject) => {
    const req = https.request(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            tokens.access_token = body.access_token;
            if (body.refresh_token) {
              tokens.refresh_token = body.refresh_token;
            }
            tokens.expires_in = body.expires_in;
            tokens.expires_at = Date.now() + (body.expires_in * 1000);

            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log('Token refreshed successfully.');
            resolve();
          } else {
            console.error('ERROR: Token refresh failed:', body.error_description || body.error || `HTTP ${res.statusCode}`);
            if (body.error === 'invalid_grant' || body.error === 'interaction_required') {
              console.error('Refresh token expired. Re-authenticate with /outlook-auth.');
            }
            process.exit(1);
          }
        } catch (e) {
          console.error('ERROR: Failed to parse response:', e.message);
          process.exit(1);
        }
      });
    });

    req.on('error', (err) => {
      console.error('ERROR: Network error:', err.message);
      process.exit(1);
    });

    req.write(postData);
    req.end();
  });
}

if (require.main === module) {
  refreshToken().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = { refreshToken };
