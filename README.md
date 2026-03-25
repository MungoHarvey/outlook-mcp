# Outlook Skills for Claude Code

A Claude Code plugin providing skills for interacting with Microsoft Outlook — email, calendar, contacts, folders, rules, and categories — via the Microsoft Graph API.

## How It Works

This project is a **Claude Code plugin** using skill files that teach Claude the Microsoft Graph API patterns. All API calls go through `scripts/graph_call.py`, a secure Python proxy that injects Bearer tokens internally. Tokens are stored in `outlook-skills/tokens.json` (gitignored) and never exposed to Claude.

Authentication is handled by `outlook-skills/auth-server.js` — a small Node.js HTTP server that performs the OAuth 2.0 Authorization Code flow identically to the companion MCP server: a server-side redirect to Microsoft login, a local callback to exchange the code for tokens, and silent refresh thereafter.

## Prerequisites

- **Node.js** 14+ (for the auth server)
- **Python** 3.9+ (for `graph_call.py` and `token_helper.py`)
- An **Azure App Registration** with the required API permissions (see below)

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone --branch plugin-dev https://github.com/MungoHarvey/outlook-mcp.git
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

4. **Install as a Claude Code plugin:**
   ```bash
   cc --plugin-dir /path/to/outlook-mcp
   ```

   Alternatively, for **Claude Desktop / Cowork**, package as a zip:
   ```bash
   bash setup/package.sh          # macOS/Linux
   .\setup\package.ps1            # Windows
   ```
   Then import via Settings → Skills → Import from zip.

5. **Install test dependencies (optional):**
   ```bash
   npm install
   ```

6. **Use naturally in Claude:**
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

### 1. Register the App

1. Open [Azure Portal](https://portal.azure.com/) and search for **App registrations**
2. Click **New registration**
3. **Name:** anything descriptive (e.g. "Outlook Skills")
4. **Supported account types:** Accounts in any organizational directory and personal Microsoft accounts
5. **Redirect URI:** select **Web** and enter `http://localhost:8400/auth/callback`
6. Click **Register**
7. Copy the **Application (client) ID** — you'll need this for your `.env` file

### 2. Add API Permissions

1. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
2. Add the following permissions:

   | Permission | Purpose |
   |---|---|
   | `offline_access` | Silent token refresh |
   | `User.Read` | Read your profile |
   | `Mail.Read` | Read emails |
   | `Mail.ReadWrite` | Organise, move, delete emails |
   | `Mail.Send` | Send emails |
   | `Calendars.Read` | Read calendar events |
   | `Calendars.ReadWrite` | Create and update events |
   | `Contacts.Read` | Read contacts |

3. Click **Add permissions**

> No admin consent is required — all permissions are delegated (user-level).

### 3. Create a Client Secret

1. Go to **Certificates & secrets** → **Client secrets** → **New client secret**
2. Add a description and select an expiration period
3. Click **Add**
4. **Copy the VALUE** (the long string) — not the Secret ID. You will not be able to see it again.

### 4. Configure `.env`

Edit `outlook-skills/.env`:

```bash
OUTLOOK_TENANT_ID=common
OUTLOOK_CLIENT_ID=your-application-client-id-here
OUTLOOK_CLIENT_SECRET=your-client-secret-value-here
```

Use `OUTLOOK_TENANT_ID=common` for personal Microsoft accounts. For a work or school account restricted to a single tenant, use your Azure tenant ID instead — but note that tenant-specific endpoints may require admin consent for some permissions.

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
.claude-plugin/
  plugin.json                            # Plugin manifest

skills/                                  # 19 skill folders (auto-discovered by plugin)
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

Each skill folder contains a lean `SKILL.md` (~40-60 lines) plus adjacent `reference.md` and optional `params.yaml`. Paths in skill files use `${CLAUDE_PLUGIN_ROOT}` for portability.

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
