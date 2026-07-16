# outlook-skills — Auth system

This directory holds the authentication for the Outlook skills: an OAuth 2.0
server, the token store, and the token helper the Graph proxy uses. Tokens are
never exposed to the LLM.

## Files

| File | Role |
|---|---|
| `auth-server.js` | Node.js OAuth 2.0 server (default port 8400) — runs the login flow and writes tokens |
| `auth.sh` / `auth.ps1` | Entry points that invoke `auth-server.js` |
| `token_helper.py` | Loads tokens, refreshes silently, enforces the 30-day session — used by `scripts/graph_call.py` |
| `scopes.json` | Canonical OAuth scope list (single source of truth) |
| `.env` | Azure app credentials (gitignored) — copy from `.env.example` |
| `tokens.json` | Access/refresh tokens (gitignored, created with restrictive permissions) |

## Setup

### 1. Register an Azure app
See `setup/AZURE_SETUP.md` for the full walkthrough. In short: create an app
registration (any org directory + personal accounts), add a **Web** redirect URI
`http://localhost:8400/auth/callback`, create a client **secret**, and add the
delegated permissions listed in `scopes.json`. No admin consent is required —
all scopes are delegated (user-level).

### 2. Create credentials
```bash
cp outlook-skills/.env.example outlook-skills/.env
```
Fill in `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET` (the secret **value**, not
the Secret ID), and `OUTLOOK_TENANT_ID` (`common` for personal accounts).

### 3. Authenticate
```bash
bash outlook-skills/auth.sh          # macOS / Linux / WSL / Git Bash
```
```powershell
.\outlook-skills\auth.ps1            # Windows
```
A browser opens; sign in and approve. Tokens are written to `tokens.json`.

## Session management

| Action | bash | PowerShell |
|---|---|---|
| Check status | `bash outlook-skills/auth.sh --status` | `.\outlook-skills\auth.ps1 -Status` |
| Force re-login | `bash outlook-skills/auth.sh --reauth` | `.\outlook-skills\auth.ps1 -Reauth` |
| Revoke (delete local tokens) | `bash outlook-skills/auth.sh --revoke` | `.\outlook-skills\auth.ps1 -Revoke` |

Sessions expire after **30 days** (a self-imposed cap) and require `--reauth`.
If you add scopes, existing sessions must `--reauth` to consent to them; a
`--status` banner flags when the stored grant is missing a required scope.

## Security model

- **Tokens are never exposed to the LLM.** All Graph calls go through
  `scripts/graph_call.py`, which injects the Bearer token internally and returns
  only the JSON response.
- `tokens.json` is plain JSON (gitignored) created with restrictive permissions
  (mode 0600 on POSIX; a user-only ACL via `icacls` on Windows) at write time.
- The **client secret is NOT stored in `tokens.json`** — silent refresh reads it
  from `outlook-skills/.env`, so a leaked token file can't also leak the app secret.
- The OAuth callback validates a single-use `state`, pins the `Host` header to
  loopback, HTML-escapes its output, and times out if a login is abandoned.

> Note: tokens are stored as plain (gitignored, permission-restricted) JSON, not
> encrypted at rest. Treat `outlook-skills/` as sensitive.
