# outlook-skills

Microsoft Outlook integration for Claude — email, calendar, contacts, folders, and inbox rules via the Microsoft Graph API.

## Overview

This project gives Claude access to your Microsoft 365 account. Each skill teaches
Claude which Graph API endpoints to call; every call goes through a secure Python
proxy (`scripts/graph_call.py`) that injects your token internally — so tokens are
never exposed to the LLM.

Two ways to run it:

- **Claude Code (recommended):** load the skills as a plugin (`cc --plugin-dir .`).
  Skills call `scripts/graph_call.py` directly.
- **Claude Desktop / Cowork:** a small stdio MCP server (`mcp-server/`) proxies the
  same Graph calls where skills can't shell out. It's wired via `.mcp.json`.

## Components

| Component | Count | Purpose |
|-----------|-------|---------|
| Skills | 20 | Domain knowledge for email, calendar, contacts, folders, rules |
| Graph proxy | 1 | `scripts/graph_call.py` — injects the token, validates endpoints |
| MCP server | 1 | `mcp-server/` — stdio transport for Claude Desktop / Cowork |

## Setup

### Fastest path — let Claude set it up

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

4. Create my credentials file from the template (do NOT overwrite an existing .env):
   - macOS/Linux/WSL:  cp outlook-skills/.env.example outlook-skills/.env
   - Windows:          Copy-Item outlook-skills\.env.example outlook-skills\.env

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

6. When I give you those three values, write them into outlook-skills/.env. Do not print
   my client secret back to me — just confirm it was saved. (.env is gitignored.)

7. Authenticate — a browser window opens for Microsoft sign-in:
   - macOS/Linux/WSL:  bash outlook-skills/auth.sh
   - Windows:          .\outlook-skills\auth.ps1

8. Verify access:
       python3 scripts/graph_call.py GET "/me"
   A 200 response with my profile means setup is complete. Then tell me I can load the
   plugin with:  cc --plugin-dir ./outlook-mcp
   and try "/outlook-email-list" or just ask you to "check my inbox".

All Microsoft Graph calls must go through scripts/graph_call.py — never read token files
directly. My credentials stay in outlook-skills/.env and tokens in
outlook-skills/tokens.json, both of which are gitignored and never leave my machine.
```

> Already have the plugin loaded? Just run **`/outlook-setup`** (or say "set up Outlook") for the same flow. A standalone copy of this prompt also lives in [`setup/SETUP-PROMPT.md`](setup/SETUP-PROMPT.md). The manual steps below are for reference.

### Prerequisites

- Node.js >= 18.0.0
- A Microsoft 365 account (personal or organisational)
- Azure AD app registration with Graph API permissions

### 1. Create credentials

```bash
cp outlook-skills/.env.example outlook-skills/.env    # then fill in your Azure app details
```

See [`setup/AZURE_SETUP.md`](setup/AZURE_SETUP.md) for the Azure walkthrough. The
**Web** redirect URI must be `http://localhost:8400/auth/callback`.

### 2. Authenticate

**Windows:**
```powershell
.\outlook-skills\auth.ps1
```

**macOS/Linux:**
```bash
bash outlook-skills/auth.sh
```

Follow the browser sign-in. Tokens are saved to `outlook-skills/tokens.json`
(gitignored) and auto-refresh within the 30-day session.

### 3. Load the skills

- **Claude Code:** `cc --plugin-dir .`
- **Claude Desktop / Cowork:** build the import bundle with `bash setup/package.sh`
  (or `.\setup\package.ps1`) to produce `outlook-skills.zip`, then import it via
  Settings → Skills. The MCP server's token-file path is set automatically by
  `.mcp.json` — no manual environment variable needed.

## Usage

Once installed and authenticated, Claude will automatically use the outlook skills when you ask about email, calendar, or contacts. Examples:

- "Check my recent emails"
- "What's on my calendar this week?"
- "Send a reply to the message from Sarah"
- "Create a meeting for tomorrow at 2pm"

## Security

- Tokens are stored locally in `outlook-skills/tokens.json` (gitignored, never bundled)
- The token is never exposed to the LLM — `graph_call.py` injects it internally
- The client secret is **not** stored in `tokens.json`; refresh reads it from `.env`
- Endpoint validation restricts requests to `/me` and `/users/` paths (segment-exact)
- Token files are created with restrictive permissions (chmod 600 on Unix, a
  user-only ACL via icacls on Windows) at write time
- 30-day session limit enforces periodic re-authentication

## Customisation

This plugin uses Microsoft Graph API directly. No `~~` placeholders are needed — it's specific to Microsoft 365.
