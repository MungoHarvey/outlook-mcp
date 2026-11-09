# outlook-skills

Microsoft Outlook integration for Claude — email, calendar, contacts, folders, and inbox rules via the Microsoft Graph API.

## Overview

This is a **Claude Code plugin** built around 20 skills and a secure token proxy:

- **Skills** are the intelligence layer — each one teaches Claude the right Graph API calls for a task (list inbox, send mail, book meetings, manage contacts, create rules, …).
- **`scripts/graph_call.py`** is the execution layer — a proxy that injects the token internally and returns only the JSON response. Tokens and credentials never reach the model.
- **`outlook-skills/`** holds the auth system — a Node.js OAuth 2.0 server plus entry scripts (`auth.sh` / `auth.ps1`) that store tokens locally with a 30-day session limit.

| Component | Count | Purpose |
|-----------|-------|---------|
| Skills | 20 | Email, calendar, contacts, folders, rules, categories, setup, auth |
| Graph proxy | 1 | `graph_call.py` — authenticated API calls, tokens never exposed |
| MCP server | 1 (optional) | Only for Claude Desktop / Cowork; not used by Claude Code |

## Install

### As a Claude Code plugin (recommended)

```
/plugin marketplace add MungoHarvey/outlook-mcp
/plugin install outlook-skills@outlook-mcp
```

Then run `/outlook-setup` inside Claude Code — it walks you through the Azure app registration (with a visual guide) and authentication. Your credentials live in `~/.outlook-skills/` (or `$OUTLOOK_SKILLS_HOME`), so they survive plugin updates.

### From a local clone (development)

```bash
git clone https://github.com/MungoHarvey/outlook-mcp.git
claude --plugin-dir ./outlook-mcp
```

With a clone, new auth state is created in `~/.outlook-skills/` too. An older clone that already keeps `tokens.json` in the repo's `outlook-skills/` is still picked up there (legacy layout); see [Moving existing credentials to `~/.outlook-skills`](#moving-existing-credentials-to-outlook-skills).

### Claude Desktop / Cowork (zip import)

```bash
bash setup/package.sh          # macOS/Linux
.\setup\package.ps1            # Windows
```

Produces `outlook-skills.zip` — import via Settings → Skills. Complete authentication in the repo first.

## Fastest path — let Claude set it up

Copy the prompt below and paste it into a fresh **Claude Code** session (run `claude` in a terminal where you want the project cloned). Claude clones the repo, installs dependencies, prepares the project, then opens the visual Azure guide ([`setup/azure-setup-guide.html`](setup/azure-setup-guide.html)) in your browser and finishes by authenticating you. You only supply three Azure values (~5 min).

```text
You are helping me set up the Outlook Skills plugin (Microsoft Outlook integration
for Claude via the Microsoft Graph API) on my computer. Work through the steps below
ONE AT A TIME, confirming each succeeds before moving to the next. Detect my operating
system and adapt every command accordingly (Windows → PowerShell; macOS / Linux / WSL →
bash). Ask me before doing anything destructive. Never display, log, or echo my client
secret or any authentication token.

1. Detect my OS and confirm prerequisites are installed:
   - Node.js 18+   (node --version)
   - Python 3.10+  (python3 --version, or python --version on Windows)
   - git           (git --version)
   If any are missing, give me the official download link and stop until I confirm it's
   installed.

2. Clone the repository into the current directory (skip if an "outlook-mcp" folder is
   already here), then move into it:
       git clone https://github.com/MungoHarvey/outlook-mcp.git
       cd outlook-mcp

3. Install Node dependencies:
       npm install

4. Create my credentials file from the template in ~/.outlook-skills (do NOT overwrite an existing .env):
   - macOS/Linux/WSL:  mkdir -p ~/.outlook-skills && cp -n outlook-skills/.env.example ~/.outlook-skills/.env
   - Windows:          New-Item -ItemType Directory -Force "$env:USERPROFILE\.outlook-skills"; if (-not (Test-Path "$env:USERPROFILE\.outlook-skills\.env")) { Copy-Item outlook-skills\.env.example "$env:USERPROFILE\.outlook-skills\.env" }

5. I now need to register an Azure app to get my credentials. Open the visual setup guide
   in my default browser so I can follow the screenshots:
   - Windows:    Start-Process "setup/azure-setup-guide.html"
   - macOS:      open "setup/azure-setup-guide.html"
   - Linux/WSL:  xdg-open "setup/azure-setup-guide.html"
   Then summarise the 8 Azure steps for me in chat and tell me exactly which three values
   to bring back:
   - OUTLOOK_CLIENT_ID   (Application/client ID)
   - OUTLOOK_TENANT_ID   (use "common" for a personal Microsoft account)
   - the client secret VALUE  (the longer string — NOT the Secret ID, which causes
     error AADSTS7000215)

6. When I give you those three values, write them into ~/.outlook-skills/.env. Do not print
   my client secret back to me — just confirm it was saved. (.env is gitignored.)

7. Authenticate — a browser window opens for Microsoft sign-in:
   - macOS/Linux/WSL:  bash outlook-skills/auth.sh
   - Windows:          powershell -NoProfile -File ".\outlook-skills\auth.ps1"

8. Verify access:
       python3 scripts/graph_call.py GET "/me"
   A 200 response with my profile means setup is complete. Then tell me I can load the
   plugin with:  claude --plugin-dir ./outlook-mcp
   and try "/outlook-email-list" or just ask you to "check my inbox".

All Microsoft Graph calls must go through scripts/graph_call.py — never read token files
directly. My credentials stay in ~/.outlook-skills/.env and tokens in
~/.outlook-skills/tokens.json, outside the repo, and never leave my machine.
```

> Already have the plugin loaded? Just run **`/outlook-setup`** (or say "set up Outlook") for the same flow. A standalone copy of this prompt also lives in [`setup/SETUP-PROMPT.md`](setup/SETUP-PROMPT.md).

## Prerequisites

- Node.js >= 18.0.0
- Python 3.10+
- A Microsoft 365 account (personal or organisational)
- Azure AD app registration with Graph API permissions (the setup flow walks you through this)

Prefer a manual setup? [`setup/AZURE_SETUP.md`](setup/AZURE_SETUP.md) has the full Azure walkthrough. The **Web** redirect URI must be `http://localhost:8400/auth/callback`.

## Where auth state lives

`.env` (credentials) and `tokens.json` (tokens) are resolved in this order by every component:

1. `$OUTLOOK_SKILLS_HOME`, if set and non-empty — explicit override (a leading `~` is expanded and the path made absolute)
2. `~/.outlook-skills` (Windows: `%USERPROFILE%\.outlook-skills`), if it holds a `.env` or `tokens.json` file
3. The plugin's own `outlook-skills/` folder, **only if it holds `tokens.json`** — the legacy cloned-repo layout; a `.env` alone there no longer counts
4. Otherwise `~/.outlook-skills`, where new state is created

`$OUTLOOK_TOKEN_FILE` overrides only the token file. `.env` is read only from the chosen directory.

Auth management (from a clone; for a plugin install, use the plugin path shown by `/outlook-setup`). `--where` / `-Where` prints the chosen directory, the token file and the checked directories (paths only):

```bash
bash outlook-skills/auth.sh --status   # check token validity
bash outlook-skills/auth.sh --reauth   # force re-authentication
bash outlook-skills/auth.sh --revoke   # revoke and delete all tokens
bash outlook-skills/auth.sh --where    # show where auth state is looked up
```

On Windows, use PowerShell (never `bash` from PowerShell, which runs WSL; WSL cannot read Windows paths):

```powershell
powershell -NoProfile -File "<path>\outlook-skills\auth.ps1" -Status
powershell -NoProfile -File "<path>\outlook-skills\auth.ps1" -Reauth
powershell -NoProfile -File "<path>\outlook-skills\auth.ps1" -Revoke
powershell -NoProfile -File "<path>\outlook-skills\auth.ps1" -Where
```

The same lookup is available from `python outlook-skills/token_helper.py --where` and `node outlook-skills/auth-server.js --where`.

## Moving existing credentials to `~/.outlook-skills`

If your `.env` and `tokens.json` sit in the repo's `outlook-skills/` folder, move them to `~/.outlook-skills`. Run these from the repo root. The copy never overwrites: it stops if a `.env` or `tokens.json` already exists at the destination.

1. Create the directory with user-only access.

   PowerShell:
   ```powershell
   $dest = "$env:USERPROFILE\.outlook-skills"
   New-Item -ItemType Directory -Force $dest | Out-Null
   icacls "$env:USERPROFILE\.outlook-skills" /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F"
   ```
   macOS / Linux / Git Bash:
   ```bash
   mkdir -p ~/.outlook-skills && chmod 700 ~/.outlook-skills
   ```
2. Copy, never overwrite.

   PowerShell:
   ```powershell
   foreach ($f in '.env', 'tokens.json') {
     if (-not (Test-Path "outlook-skills\$f")) { continue }
     if (Test-Path "$dest\$f") { throw "$dest\$f already exists; not overwriting" }
     Copy-Item "outlook-skills\$f" "$dest\$f"
   }
   ```
   macOS / Linux / Git Bash:
   ```bash
   for f in .env tokens.json; do
     [ -f "outlook-skills/$f" ] || continue
     [ -e ~/.outlook-skills/$f ] && { echo "~/.outlook-skills/$f already exists; not overwriting" >&2; break; }
     cp -n "outlook-skills/$f" ~/.outlook-skills/$f && chmod 600 ~/.outlook-skills/$f
   done
   ```
3. Verify. `-Where` / `--where` should report `~/.outlook-skills` as the state directory; then check the token.

   ```powershell
   powershell -NoProfile -File "<path>\outlook-skills\auth.ps1" -Where
   powershell -NoProfile -File "<path>\outlook-skills\auth.ps1" -Status
   ```
   ```bash
   bash outlook-skills/auth.sh --where
   bash outlook-skills/auth.sh --status
   ```
4. Only then delete the old copies in the repo's `outlook-skills/` (`.env`, `tokens.json`).


## Usage

Once installed and authenticated, Claude automatically uses the Outlook skills when you ask about email, calendar, or contacts:

- "Check my recent emails"
- "What's on my calendar this week?"
- "Send a reply to the message from Sarah"
- "Create a meeting for tomorrow at 2pm"

Destructive operations (sending, deleting, cancelling, creating rules) always ask for your confirmation first.

## Optional: MCP server for Claude Desktop / Cowork

`mcp-server/` contains a small stdio MCP server exposing `outlook_auth` and `outlook_api` tools. It is **not** part of the Claude Code plugin. To use it with Claude Desktop, install its dependencies and register it explicitly:

```bash
cd mcp-server && npm install
```

```json
{
  "mcpServers": {
    "outlook": {
      "command": "node",
      "args": ["/path/to/outlook-mcp/mcp-server/src/index.js"]
    }
  }
}
```

It shares the same token store as the skills (same resolution order as above).

## Security

- Tokens are stored locally in `tokens.json` (gitignored, never bundled or committed)
- The token is never exposed to the LLM — `graph_call.py` injects it internally
- The client secret is **not** stored in `tokens.json`; refresh reads it from `.env`
- Endpoint validation restricts requests to `/me` and `/users/` paths (segment-exact)
- Token files are created with restrictive permissions (chmod 600 on Unix, a
  user-only ACL via icacls on Windows) at write time
- 30-day session limit enforces periodic re-authentication
- `test/static/security.test.js` fails CI if any skill file ever references tokens, curl, or raw Authorization headers

## License

[MIT](LICENSE)
