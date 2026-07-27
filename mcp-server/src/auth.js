/**
 * auth.js — Token management for Microsoft Graph API.
 *
 * Direct port of outlook-skills/token_helper.py to Node.js.
 * Reads/writes the SAME tokens.json file, so both the Python
 * (Claude Code) and Node.js (Cowork MCP) paths share auth state.
 *
 * Token file location (checked in order):
 *   1. OUTLOOK_TOKEN_FILE env var    (explicit file override)
 *   2. OUTLOOK_SKILLS_HOME env var   (state dir override → <dir>/tokens.json)
 *   3. ../../outlook-skills/tokens.json when it exists (cloned-repo layout)
 *   4. ~/.outlook-skills/tokens.json (stable default, survives plugin updates)
 *
 * Exports:
 *   getToken()       → valid Bearer access token (string)
 *   getSessionInfo() → human-readable session metadata (no secrets)
 */

import { readFile, writeFile, rename, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

// ── Constants ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Must mirror the resolution in outlook-skills/token_helper.py — the Python
// (Claude Code) and Node.js (Cowork MCP) paths share the same auth state.
function resolveTokenFile() {
  if (process.env.OUTLOOK_TOKEN_FILE) return process.env.OUTLOOK_TOKEN_FILE;
  if (process.env.OUTLOOK_SKILLS_HOME) {
    return join(process.env.OUTLOOK_SKILLS_HOME, "tokens.json");
  }
  const legacy = join(__dirname, "..", "..", "outlook-skills", "tokens.json");
  if (existsSync(legacy)) return legacy;
  return join(homedir(), ".outlook-skills", "tokens.json");
}

const TOKEN_FILE = resolveTokenFile();

const MAX_SESSION_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const TOKEN_ENDPOINT  = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token";

// ── Custom Errors ────────────────────────────────────────────────────────────

export class AuthRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class TokenRefreshError extends Error {
  constructor(message) {
    super(message);
    this.name = "TokenRefreshError";
  }
}

// ── Internal: load + save ────────────────────────────────────────────────────

/**
 * Load tokens from disk.
 * @returns {object} Parsed token data
 * @throws {AuthRequiredError} If file missing or unreadable
 */
async function loadTokens() {
  if (!existsSync(TOKEN_FILE)) {
    throw new AuthRequiredError(
      `No token file found at ${TOKEN_FILE}. Run: .\\outlook-skills\\auth.ps1`
    );
  }
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    throw new AuthRequiredError(
      `Could not read token store (${err.message}). ` +
      "Run: .\\outlook-skills\\auth.ps1 --reauth"
    );
  }
}

/**
 * Persist updated tokens (atomic write via tmp + rename).
 * Sets restrictive file permissions on the result.
 * @param {object} tokens Token data to save
 */
async function saveTokens(tokens) {
  const tmpPath = TOKEN_FILE + ".tmp";
  await writeFile(tmpPath, JSON.stringify(tokens, null, 2), { encoding: "utf-8", mode: 0o600 });
  await rename(tmpPath, TOKEN_FILE);

  // Restrict file permissions
  if (process.platform === "win32") {
    // Windows: use icacls to restrict access to current user
    const username = process.env.USERNAME || process.env.USER || "";
    if (username) {
      execFile(
        "icacls",
        [TOKEN_FILE, "/inheritance:r", "/grant:r", `${username}:(R,W)`],
        () => {} // non-fatal — ACL failure doesn't break token use
      );
    }
  } else {
    // Unix: chmod 600
    await chmod(TOKEN_FILE, 0o600);
  }
}

// ── Internal: token refresh ──────────────────────────────────────────────────

/**
 * Use the refresh token to obtain a new access token from Azure AD.
 * @param {object} tokens Current token data
 * @returns {object} Updated token data with new access_token
 * @throws {AuthRequiredError} If refresh token is rejected (re-auth needed)
 * @throws {TokenRefreshError} If refresh fails for a transient reason
 */
async function refreshAccessToken(tokens) {
  const tenantId     = tokens.tenant_id || "";
  const clientId     = tokens.client_id || "";
  const clientSecret = tokens.client_secret ||
                       process.env.OUTLOOK_CLIENT_SECRET || "";

  if (!clientSecret) {
    throw new AuthRequiredError(
      "client_secret not found in token store or environment. " +
      "Run: .\\outlook-skills\\auth.ps1 --reauth"
    );
  }

  const url = TOKEN_ENDPOINT.replace("{tenant}", tenantId);

  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    "refresh_token",
    refresh_token: tokens.refresh_token,
  });

  let response;
  try {
    response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      signal:  AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new TokenRefreshError(`Network error during token refresh: ${err.message}`);
  }

  if (!response.ok) {
    let errorData = {};
    try { errorData = await response.json(); } catch { /* ignore */ }

    const errorCode = errorData.error || "";
    const fatalCodes = ["invalid_grant", "interaction_required", "consent_required"];

    if (fatalCodes.includes(errorCode)) {
      throw new AuthRequiredError(
        `Refresh token rejected (${errorCode}). ` +
        "Run: .\\outlook-skills\\auth.ps1 --reauth"
      );
    }
    throw new TokenRefreshError(
      `Token refresh failed: ${errorCode} — ${JSON.stringify(errorData)}`
    );
  }

  const data = await response.json();

  // Update tokens — preserve session_started_at (enforces 30-day limit)
  tokens.access_token            = data.access_token;
  tokens.access_token_expires_at = nowSecs() + (data.expires_in || 3600) - 60;

  // Azure may rotate the refresh token — always update if provided
  if (data.refresh_token) {
    tokens.refresh_token = data.refresh_token;
  }

  return tokens;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Current time in seconds (matches Python's time.time()). */
function nowSecs() {
  return Math.floor(Date.now() / 1000);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Return a valid Bearer access token.
 *
 * Transparently handles:
 *   - Loading from local token store
 *   - Silent refresh when access token is expired
 *   - 30-day session enforcement
 *
 * @returns {string} Valid access token
 * @throws {AuthRequiredError} If setup or re-auth is needed
 * @throws {TokenRefreshError} If refresh fails transiently
 */
export async function getToken() {
  const tokens = await loadTokens();

  // 30-day session check
  const sessionAge = nowSecs() - (tokens.session_started_at || 0);
  if (sessionAge > MAX_SESSION_AGE) {
    await saveTokens({});
    throw new AuthRequiredError(
      "Session has expired (30-day limit). " +
      "Run: .\\outlook-skills\\auth.ps1 --reauth"
    );
  }

  // Access token still valid?
  if (nowSecs() < (tokens.access_token_expires_at || 0)) {
    return tokens.access_token;
  }

  // Silently refresh
  const updated = await refreshAccessToken(tokens);
  await saveTokens(updated);
  return updated.access_token;
}

/**
 * Return human-readable session metadata (no secrets exposed).
 * @returns {object} Session info suitable for tool output
 */
export async function getSessionInfo() {
  try {
    const tokens = await loadTokens();
    const age      = nowSecs() - (tokens.session_started_at || 0);
    const daysLeft = Math.max(0, Math.floor((MAX_SESSION_AGE - age) / 86400));

    return {
      authenticated:  true,
      user_email:     tokens.user_email || "unknown",
      days_remaining: daysLeft,
      scopes:         tokens.scopes || [],
      token_valid:    nowSecs() < (tokens.access_token_expires_at || 0),
    };
  } catch {
    return { authenticated: false };
  }
}
