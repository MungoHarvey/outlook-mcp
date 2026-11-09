/**
 * auth.js — Token management for Microsoft Graph API.
 *
 * Direct port of outlook-skills/token_helper.py to Node.js.
 * Reads/writes the SAME tokens.json file, so both the Python
 * (Claude Code) and Node.js (Cowork MCP) paths share auth state.
 *
 * Exports:
 *   getToken()          → valid Bearer access token (string)
 *   getSessionInfo()    → human-readable session metadata (no secrets)
 *   authStatusText()    → reply text for the MCP status/login actions
 *   authCommand()       → platform-correct auth command for an action
 *   resolveStateDir()   → { state_dir, token_file, checked_dirs }
 *   AuthRequiredError   → error class for auth failures
 *   TokenRefreshError   → error class for refresh failures
 */

import { readFile, writeFile, rename, chmod } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

// ── Constants ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// "Holds state" means a regular file, matching token_helper.py's is_file().
function isFile(p) {
  return statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
}

// The user's home directory, as the state lookup sees it (USERPROFILE on Windows).
function userHomeDir() {
  const homeVar = platform() === "win32" ? process.env.USERPROFILE : process.env.HOME;
  return homeVar || homedir();
}

// A leading ~ means the home directory (token_helper.py uses expanduser());
// the path is then made absolute against the process cwd.
function expandAndAbsolute(p, userHome) {
  const expanded = (p === "~" || p.startsWith("~/") || p.startsWith("~\\"))
    ? join(userHome, p.slice(1))
    : p;
  return resolve(expanded);
}

// State directory resolution — mirrors outlook-skills/token_helper.py exactly.
// Returns { state_dir, checked_dirs } where checked_dirs is the ordered list
// of directories examined.
function resolveStateDirWithCheckedDirs() {
  const checkedDirs = [];
  const userHome = userHomeDir();
  const homeDir = join(userHome, ".outlook-skills");
  const pluginDir = join(__dirname, "..", "..", "outlook-skills");

  // Rule 1: OUTLOOK_SKILLS_HOME if set and non-empty
  const envHome = process.env.OUTLOOK_SKILLS_HOME;
  if (envHome) {
    const overrideDir = expandAndAbsolute(envHome, userHome);
    checkedDirs.push(overrideDir);
    return { stateDir: overrideDir, checkedDirs };
  }

  // Rule 2: ~/.outlook-skills if it contains .env or tokens.json as files
  checkedDirs.push(homeDir);
  if (isFile(join(homeDir, ".env")) || isFile(join(homeDir, "tokens.json"))) {
    return { stateDir: homeDir, checkedDirs };
  }

  // Rule 3: Plugin folder only if it contains tokens.json (not just .env)
  checkedDirs.push(pluginDir);
  if (isFile(join(pluginDir, "tokens.json"))) {
    return { stateDir: pluginDir, checkedDirs };
  }

  // Rule 4: Default to ~/.outlook-skills (creation target)
  return { stateDir: homeDir, checkedDirs };
}

const { stateDir: STATE_DIR, checkedDirs: CHECKED_DIRS } = resolveStateDirWithCheckedDirs();

// OUTLOOK_TOKEN_FILE overrides only the token file path, made absolute
const TOKEN_FILE_OVERRIDE = process.env.OUTLOOK_TOKEN_FILE
  ? expandAndAbsolute(process.env.OUTLOOK_TOKEN_FILE, userHomeDir())
  : null;
const TOKEN_FILE = TOKEN_FILE_OVERRIDE || join(STATE_DIR, "tokens.json");

// Dependency-free .env loader. The client secret is no longer stored in
// tokens.json, so silent refresh must read OUTLOOK_CLIENT_SECRET from
// outlook-skills/.env (mirrors token_helper.py._load_env_file). .env wins,
// matching auth-server.js, so all three paths agree on the secret source.
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
// Load .env exactly once from the chosen state directory (fixes the overwrite bug).
loadEnvFile(join(STATE_DIR, ".env"));

const MAX_SESSION_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const TOKEN_ENDPOINT  = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token";

// Build platform-correct auth command (mirrors token_helper.py._make_auth_cmd).
export function authCommand(action = "") {
  const authScriptDir = __dirname; // outlook-skills/ is next to src/
  const isWin = platform() === "win32";
  if (isWin) {
    const scriptPath = join(authScriptDir, "..", "..", "outlook-skills", "auth.ps1");
    const absPath = resolve(scriptPath);
    let cmd = `powershell -NoProfile -File "${absPath}"`;
    if (action === "reauth") cmd += " -Reauth";
    else if (action === "status") cmd += " -Status";
    return cmd;
  } else {
    const scriptPath = join(authScriptDir, "..", "..", "outlook-skills", "auth.sh");
    const absPath = resolve(scriptPath);
    let cmd = `bash "${absPath}"`;
    if (action) cmd += ` --${action}`;
    return cmd;
  }
}

// Format checked directories for error messages.
function checkedDirsStr(dirs) {
  return dirs.join("; ");
}

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
      `No token file found. Checked: ${checkedDirsStr(CHECKED_DIRS)}. ` +
      `Run: ${authCommand("reauth")}`
    );
  }
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    throw new AuthRequiredError(
      `Could not read token store (the token file is not valid JSON). ` +
      `Checked: ${checkedDirsStr(CHECKED_DIRS)}. ` +
      `Run: ${authCommand("reauth")}`
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
      `client_secret not found. Checked: ${checkedDirsStr(CHECKED_DIRS)}. ` +
      `Copy your existing .env to ${STATE_DIR}, then run: ${authCommand("reauth")}`
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
        `Checked: ${checkedDirsStr(CHECKED_DIRS)}. ` +
        `Run: ${authCommand("reauth")}`
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
      `Session has expired (30-day limit). Checked: ${checkedDirsStr(CHECKED_DIRS)}. ` +
      `Run: ${authCommand("reauth")}`
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

// Export resolveStateDir for probing and testing.
export function resolveStateDir() {
  return {
    state_dir: STATE_DIR,
    token_file: TOKEN_FILE,
    checked_dirs: CHECKED_DIRS,
  };
}

/**
 * Return human-readable session metadata (no secrets exposed).
 * Only "not signed in" is folded into the result; any other error propagates,
 * so it is not reported as a missing sign-in.
 * @returns {object} Session info suitable for tool output
 */
export async function getSessionInfo() {
  let tokens;
  try {
    tokens = await loadTokens();
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return { authenticated: false, message: err.message };
    }
    throw err;
  }

  const age      = nowSecs() - (tokens.session_started_at || 0);
  const daysLeft = Math.max(0, Math.floor((MAX_SESSION_AGE - age) / 86400));

  return {
    authenticated:  true,
    user_email:     tokens.user_email || "unknown",
    days_remaining: daysLeft,
    scopes:         tokens.scopes || [],
    token_valid:    nowSecs() < (tokens.access_token_expires_at || 0),
  };
}

/**
 * Build the reply text for the MCP status and login actions.
 * @param {object|Error} result A getSessionInfo() result, or an error from getToken()/getSessionInfo()
 * @returns {string} Text to show the user
 */
export function authStatusText(result) {
  if (result instanceof TokenRefreshError) {
    return "Sign-in could not be refreshed (network or service error): " +
           `${result.message}. Retry, or run: ${authCommand("reauth")}`;
  }
  if (result instanceof AuthRequiredError) return result.message;
  if (result instanceof Error) return `Could not check sign-in status: ${result.message}`;
  if (!result.authenticated) return result.message;
  return JSON.stringify(result, null, 2);
}
