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

> **Fastest path — let Claude set it up.** Paste the one-paste prompt in **[`setup/SETUP-PROMPT.md`](setup/SETUP-PROMPT.md)** into a fresh Claude Code session. Claude clones the repo, installs dependencies, prepares the project, then opens the visual Azure guide ([`setup/azure-setup-guide.html`](setup/azure-setup-guide.html)) in your browser and finishes by authenticating you. You only supply three Azure values (~5 min).
>
> Already have the plugin loaded? Just run **`/outlook-setup`** (or say "set up Outlook") for the same flow. The manual steps below are for reference.

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
