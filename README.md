# Outlook Skills for Claude Code

Claude Code skills for interacting with Microsoft Outlook — email, calendar, contacts, folders, rules, and categories — via the Microsoft Graph API.

## How It Works

Instead of an MCP server, this project uses **Claude Code skills** — markdown files that teach Claude the Microsoft Graph API patterns. All API calls go through `scripts/graph_call.py`, a secure Python proxy that injects Bearer tokens internally. Tokens are stored in `outlook-skills/tokens.json` (gitignored) and never exposed to Claude.

Authentication is handled by `outlook-skills/auth-server.js` — a small Node.js HTTP server that performs the OAuth 2.0 Authorization Code flow identically to the companion MCP server: a server-side redirect to Microsoft login, a local callback to exchange the code for tokens, and silent refresh thereafter.

## Prerequisites

- **Node.js** 14+ (for the auth server)
- **Python** 3.9+ (for `graph_call.py` and `token_helper.py`)
- An **Azure App Registration** with the required API permissions (see below)

## Quick Start

1. **Clone the repository (skills branch):**
   ```bash
   git clone --branch outlook-skills https://github.com/MungoHarvey/outlook-mcp.git
   cd outlook-mcp
   ```

2. **Create your credentials file:**
   ```bash
   # macOS / Linux / WSL
   cp outlook-skills/.env.example outlook-skills/.env

   # Windows (PowerShell)
   Copy-Item outlook-skills\.env.example outlook-skills\.env
   ```
   Edit `outlook-skills/.env` and fill in your Azure app credentials (see [Azure App Registration](#azure-app-registration) below).

3. **Authenticate:**
   ```bash
   # macOS / Linux / WSL
   bash outlook-skills/auth.sh

   # Windows (PowerShell)
   .\outlook-skills\auth.ps1
   ```
   This opens a browser tab for Microsoft login. On success, tokens are saved to `outlook-skills/tokens.json` (gitignored).

4. **Install test dependencies (optional):**
   ```bash
   npm install
   ```

5. **Use naturally in Claude:**
   ```
   Check my inbox
   What meetings do I have this week?
   Send an email to alice@example.com about the Q1 report
   Schedule a Teams meeting with Bob for tomorrow at 2pm
   Am I free Friday afternoon?
   Find Bob's phone number in my contacts
   ```
   Or invoke skills directly:
   ```
   /outlook-email-list
   /outlook-calendar-list
   /outlook-calendar-create
   /outlook-email-send
   /outlook-contacts-list
   ```

---

## Azure App Registration

You need an Azure App Registration to use these skills. Follow the **[Visual Setup Guide](setup/AZURE_SETUP.md)** for step-by-step instructions with screenshots.

**Quick summary:** Register an app in the [Azure Portal](https://portal.azure.com/), set the redirect URI to `http://localhost:8400/auth/callback`, add Microsoft Graph delegated permissions (Mail, Calendar, Contacts, User), create a client secret, and copy your credentials into `outlook-skills/.env`.

---

## Available Skills

| Domain | Command | Capabilities |
|---|---|---|
| **Auth** | `/outlook-auth` | Authenticate, check status, refresh tokens |
| **Email — List** | `/outlook-email-list` | List, search, filter emails by folder |
| **Email — Read** | `/outlook-email-read` | Read email body, view attachments |
| **Email — Draft** | `/outlook-email-draft` | Create and save draft emails |
| **Email — Send** | `/outlook-email-send` | Compose and send with CC/BCC/attachments |
| **Email — Reply** | `/outlook-email-reply` | Reply, reply-all, forward |
| **Email — Move** | `/outlook-email-move` | Move emails between folders |
| **Email — Delete** | `/outlook-email-delete` | Soft delete or permanent delete |
| **Email — Organize** | `/outlook-email-organize` | Mark read/unread, categorize, flag |
| **Calendar — List** | `/outlook-calendar-list` | View events by date range, free/busy |
| **Calendar — Create** | `/outlook-calendar-create` | Create events, Teams meetings, recurring, all-day |
| **Calendar — Update** | `/outlook-calendar-update` | Reschedule, change details, modify attendees |
| **Calendar — Respond** | `/outlook-calendar-respond` | Accept, decline, tentatively accept, cancel |
| **Contacts — List** | `/outlook-contacts-list` | List, search, filter contacts |
| **Contacts — Manage** | `/outlook-contacts-manage` | Create and update contacts |
| **Folders** | `/outlook-folders` | List, create folders; move emails |
| **Rules** | `/outlook-rules` | List, create inbox rules; modify priority |
| **Categories** | (auto) | List available Outlook categories |

---

## Authentication Management

```bash
# Check token status
bash outlook-skills/auth.sh --status        # macOS/Linux/WSL
.\outlook-skills\auth.ps1 -Status           # Windows

# Force re-authentication
bash outlook-skills/auth.sh --reauth        # macOS/Linux/WSL
.\outlook-skills\auth.ps1 -Reauth           # Windows
```

Tokens are refreshed automatically when expired. Re-authentication is only needed after the 30-day session limit or if the refresh token is revoked.

---

## Project Structure

```
.claude/skills/                          # 18 skill folders
  outlook-base/SKILL.md                  # Shared: proxy patterns, error handling
  outlook-auth/SKILL.md                  # Authentication flow
  outlook-email-{list,read,draft,send,   # 8 email operation skills
    reply,move,delete,organize}/SKILL.md
  outlook-calendar-{list,create,         # 4 calendar operation skills
    update,respond}/SKILL.md
  outlook-contacts-{list,manage}/SKILL.md # 2 contact operation skills
  outlook-folders/SKILL.md               # Folder management
  outlook-rules/SKILL.md                 # Inbox rules
  outlook-categories/SKILL.md            # Categories

outlook-skills/                          # Auth system
  auth-server.js                         # Node.js OAuth 2.0 server (port 8400)
  auth.sh                                # Entry point (macOS/Linux/WSL)
  auth.ps1                               # Entry point (Windows PowerShell)
  token_helper.py                        # Token loading, silent refresh, session enforcement
  .env.example                           # Credentials template (copy to .env)
  tokens.json                            # Live tokens (gitignored — created on first auth)

scripts/
  graph_call.py                          # Secure Graph API proxy (injects Bearer token internally)

test/
  static/                                # Skill file structure validation
  unit/                                  # Auth script unit tests
  eval/                                  # Skill selection / API pattern assertions
  integration/                           # Live API smoke tests (requires auth)
```

Each skill folder contains a lean `SKILL.md` (~40-60 lines) plus adjacent `reference.md` and optional `params.yaml`.

---

## Safety

- Destructive operations (send email, delete events, create rules) always require your confirmation before executing
- Tokens are never displayed in output or passed through Claude
- All Graph API calls are gated behind `graph_call.py` — Claude cannot access the token directly
- `tokens.json` and `.env` are gitignored and never committed

---

## Troubleshooting

**"Invalid client secret" (AADSTS7000215)**
Use the secret **VALUE** from Azure — not the Secret ID. They are shown side by side in the portal; the value is the longer string.

**"Admin approval required"**
This usually means the redirect URI in your `.env` doesn't match the one registered in Azure. Confirm `http://localhost:8400/auth/callback` is added under **Authentication → Redirect URIs** in the Azure portal.

**"Token file not found"**
Run `bash outlook-skills/auth.sh` (or `.\outlook-skills\auth.ps1` on Windows) to authenticate first.

**API returns 403**
Check that all required API permissions are added in Azure and that you have re-authenticated since adding them.

---

## Development

```bash
npm install          # install test dependencies (js-yaml, dotenv)
npm test             # run all tests (no auth required)
npm run test:static  # validate skill file structure
npm run test:unit    # auth script unit tests
npm run test:eval    # skill selection / API pattern assertions
OUTLOOK_INTEGRATION_TEST=true npm run test:integration  # live API smoke tests (requires valid token)
```

---

## License

MIT
