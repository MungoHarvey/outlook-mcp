# outlook-skills

Microsoft Outlook integration for Claude — email, calendar, contacts, folders, and inbox rules via the Microsoft Graph API.

## Overview

This plugin gives Claude access to your Microsoft 365 account through two MCP tools:

- **outlook_auth** — Check authentication status, get login/reauth guidance
- **outlook_api** — Execute authenticated Graph API requests (email, calendar, contacts)

Claude uses 19 bundled skills to know which API endpoints to call for each task. The skills are the intelligence layer; the MCP server is the execution layer.

## Components

| Component | Count | Purpose |
|-----------|-------|---------|
| Skills | 19 | Domain knowledge for email, calendar, contacts, folders, rules |
| MCP Server | 1 | stdio server proxying authenticated Graph API requests |
| Commands | 0 | Skills are triggered contextually |

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

### 1. Set the token file location

The MCP server needs to know where your authentication tokens are stored. Set this environment variable:

**Windows (PowerShell):**
```powershell
[System.Environment]::SetEnvironmentVariable("OUTLOOK_TOKEN_FILE", "C:\path\to\outlook-skills\tokens.json", "User")
```

**macOS/Linux:**
```bash
export OUTLOOK_TOKEN_FILE="/path/to/outlook-skills/tokens.json"
```

### 2. Authenticate

Run the authentication script to sign in to Microsoft 365:

**Windows:**
```powershell
.\outlook-skills\auth.ps1
```

**macOS/Linux:**
```bash
bash outlook-skills/auth.sh
```

Follow the browser-based sign-in flow. Tokens are saved to `tokens.json` and auto-refresh for 30 days.

### 3. Install the plugin

Drag `outlook-skills.plugin` into a Cowork session, or install via Claude Desktop's plugin manager.

### 4. Install MCP server dependencies

If `node_modules` wasn't bundled in the plugin:

```bash
cd mcp-server && npm install
```

## Usage

Once installed and authenticated, Claude will automatically use the outlook skills when you ask about email, calendar, or contacts. Examples:

- "Check my recent emails"
- "What's on my calendar this week?"
- "Send a reply to the message from Sarah"
- "Create a meeting for tomorrow at 2pm"

## Security

- Tokens are stored locally in `tokens.json` (never bundled in the plugin)
- The MCP server never exposes tokens in tool output
- Endpoint validation restricts requests to `/me` and `/users/` paths
- 30-day session limit enforces periodic re-authentication
- File permissions are restricted after token refresh (icacls on Windows, chmod 600 on Unix)

## Customisation

This plugin uses Microsoft Graph API directly. No `~~` placeholders are needed — it's specific to Microsoft 365.
