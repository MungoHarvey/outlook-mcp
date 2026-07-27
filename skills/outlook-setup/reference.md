# Outlook Setup — Reference

Extended guidance for the guided setup flow in [SKILL.md](SKILL.md).

## Prerequisites & install links

| Tool | Check | Install |
|---|---|---|
| Node.js (18+) | `node --version` | https://nodejs.org/ |
| Python 3 (3.10+) | `python3 --version` / `python --version` | https://www.python.org/downloads/ |
| git | `git --version` | https://git-scm.com/downloads |
| uv (optional, faster venv) | `uv --version` | https://docs.astral.sh/uv/ — falls back to pip if absent |

The auth flow (`auth.sh` / `auth.ps1`) bootstraps a local Python `.venv` under `outlook-skills/` automatically; the user does not create it manually.

## Per-OS command map

| Action | macOS / Linux / WSL / Git Bash | Windows PowerShell |
|---|---|---|
| Copy env template | `cp "${CLAUDE_PLUGIN_ROOT}/outlook-skills/.env.example" STATE_DIR/.env` | `Copy-Item "${CLAUDE_PLUGIN_ROOT}\outlook-skills\.env.example" STATE_DIR\.env` |
| Open HTML guide | `open …/setup/azure-setup-guide.html` (macOS) · `xdg-open …` (Linux/WSL) | `Start-Process "…\setup\azure-setup-guide.html"` |
| Authenticate | `bash "${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh"` | `powershell -File "${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.ps1"` |
| Check status | `bash …/auth.sh --status` | `.\outlook-skills\auth.ps1 -Status` |
| Re-authenticate | `bash …/auth.sh --reauth` | `.\outlook-skills\auth.ps1 -Reauth` |
| Revoke tokens | `bash …/auth.sh --revoke` | `.\outlook-skills\auth.ps1 -Revoke` |

## Azure steps (inline summary)

Full visual version: `setup/azure-setup-guide.html` (also `setup/AZURE_SETUP.md`). ~5 minutes.

1. **App registrations** — open https://portal.azure.com/ → *App registrations*.
2. **New registration** — click *+ New registration*.
3. **Details** — Name = anything (e.g. `outlook-skills`); Supported account types = *Accounts in any organizational directory and personal Microsoft accounts*; Redirect URI = **Web** → `http://localhost:8400/auth/callback` (must match exactly). Click *Register*.
4. **Copy credentials** — from the overview, copy **Application (client) ID** → `OUTLOOK_CLIENT_ID` and **Directory (tenant) ID** → `OUTLOOK_TENANT_ID`.
5. **Client secret** — *Certificates & secrets* → *+ New client secret* → copy the **Value** immediately (not the Secret ID). → `OUTLOOK_CLIENT_SECRET`.
6. **API permissions** — *API permissions* → *+ Add a permission* → *Microsoft Graph* → *Delegated permissions*.
7. **Select permissions** — add: `offline_access`, `User.Read`, `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.Read`, `Calendars.ReadWrite`, `Contacts.Read`. No admin consent needed.
8. **`.env`** — fill `OUTLOOK_TENANT_ID` (`common` for personal accounts), `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `AADSTS7000215: Invalid client secret` | Secret **ID** used instead of the **Value**. Create a new secret, copy the Value. |
| "Admin approval required" | Redirect URI mismatch — must be `http://localhost:8400/auth/callback` under *Authentication → Redirect URIs*. |
| Port 8400 already in use | Another auth process is running, or set `OUTLOOK_AUTH_PORT` in `.env` and update the redirect URI to match. |
| API returns `403` | Permissions added after last sign-in — re-authenticate (`--reauth` / `-Reauth`) to pick up new scopes. |
| "No refresh_token found" / token errors | Run a fresh auth: `--reauth`. |
| `graph_call.py` 500 about venv | The Python venv is missing — re-run `auth.sh` / `auth.ps1`, which creates it. |

## Security boundary

- Credentials are only in `STATE_DIR/.env`; tokens only in `STATE_DIR/tokens.json` (STATE_DIR: `$OUTLOOK_SKILLS_HOME`, the repo's `outlook-skills/` when it already holds state, or `~/.outlook-skills`). Never committed, never shown.
- Never display, log, or echo the client secret or any token back to the user.
- All Graph calls go through `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py` — never read token files directly.
