# Outlook Skills for Claude Code

Claude Code skills for interacting with Microsoft Outlook — email, calendar, contacts, folders, rules, and categories — via the Microsoft Graph API.

## How It Works

Instead of an MCP server, this project uses **Claude Code skills** — markdown files that teach Claude the Microsoft Graph API patterns. All API calls go through `scripts/graph_call.py`, a secure Python proxy that injects Bearer tokens internally. Tokens are encrypted at rest with AES-256 Fernet and stored in the OS keychain (Windows Credential Manager / macOS Keychain) — never exposed to Claude or written to disk in plain text.

## Quick Start

### Option A — Install from source

1. **Install:**
   ```bash
   # macOS / Linux / WSL
   bash setup/install.sh

   # Windows (PowerShell)
   powershell -ExecutionPolicy Bypass -File setup\install.ps1
   ```

2. **Authenticate:**
   ```bash
   bash ~/.skills/outlook-mcp/outlook-skills/auth.sh
   ```
   This opens a browser for OAuth 2.0 + PKCE login. Your client secret is prompted once and stored securely in the OS keychain.

3. **Use naturally:**

### Option B — Install from a zip package

If you have a pre-built zip (e.g. downloaded from a release or shared by a colleague):

1. **Unzip to your home directory:**
   ```bash
   # macOS / Linux / WSL
   unzip outlook-skills-YYYYMMDD.zip -d ~/

   # Windows (PowerShell)
   Expand-Archive -Path outlook-skills-YYYYMMDD.zip -DestinationPath $env:USERPROFILE
   ```

2. **Authenticate:**
   ```bash
   bash ~/.skills/outlook-mcp/outlook-skills/auth.sh
   ```

3. **Use naturally:**

### Creating a zip package

To build a shareable zip from source:

```bash
# macOS / Linux / WSL
bash setup/package.sh

# Windows (PowerShell)
.\setup\package.ps1
```

This produces `outlook-skills-YYYYMMDD.zip` in the project root, ready to share or drop onto another machine. The zip includes all skill files with paths pre-configured and the full Python auth system — the recipient only needs to unzip and run `auth.sh`.

---
   ```
   Check my inbox
   Send an email to alice@example.com about the Q1 report
   What meetings do I have this week?
   Schedule a Teams meeting with Bob for tomorrow at 2pm
   Find Bob's phone number in my contacts
   ```

   Or use slash commands directly:
   ```
   /outlook-email-list
   /outlook-email-send
   /outlook-calendar-list
   /outlook-calendar-create
   /outlook-contacts-list
   /outlook-folders
   /outlook-rules
   ```

## Available Skills

| Domain | Command | Capabilities |
|---|---|---|
| **Auth** | `/outlook-auth` | Authenticate, check status, refresh tokens |
| **Email — List** | `/outlook-email-list` | List, search, filter emails by folder |
| **Email — Read** | `/outlook-email-read` | Read email body, view attachments |
| **Email — Send** | `/outlook-email-send` | Compose and send with CC/BCC/attachments |
| **Email — Reply** | `/outlook-email-reply` | Reply, reply-all, forward |
| **Email — Move** | `/outlook-email-move` | Move emails between folders |
| **Email — Delete** | `/outlook-email-delete` | Soft delete or permanent delete |
| **Email — Organize** | `/outlook-email-organize` | Mark read/unread, categorize, flag |
| **Calendar — List** | `/outlook-calendar-list` | View events by date range, today's schedule |
| **Calendar — Create** | `/outlook-calendar-create` | Create events, Teams meetings, recurring, all-day |
| **Calendar — Update** | `/outlook-calendar-update` | Reschedule, change details, modify attendees |
| **Calendar — Respond** | `/outlook-calendar-respond` | Accept, decline, tentatively accept, cancel |
| **Contacts — List** | `/outlook-contacts-list` | List, search, filter contacts |
| **Contacts — Manage** | `/outlook-contacts-manage` | Create and update contacts |
| **Folders** | `/outlook-folders` | List, create folders; move emails |
| **Rules** | `/outlook-rules` | List, create inbox rules; modify priority |
| **Categories** | (auto) | List available Outlook categories |

## Azure App Registration

1. Open [Azure Portal](https://portal.azure.com/) > App registrations > New registration
2. Name: "Outlook Skills" (or any name)
3. Account type: "Accounts in any organizational directory and personal Microsoft accounts"
4. Redirect URI: Web — `http://localhost:8400/callback`
5. Click Register

### Required Permissions

Go to API permissions > Add a permission > Microsoft Graph > Delegated:
- `offline_access`
- `User.Read`
- `Mail.Read`
- `Mail.ReadWrite`
- `Mail.Send`
- `Calendars.Read`
- `Calendars.ReadWrite`
- `Contacts.Read`

### Configuration File

Create `~/.skills/config.json`:
```json
{
  "tenant_id": "common",
  "client_id": "your-application-client-id"
}
```

Use `tenant_id: "common"` for personal Microsoft accounts, or your Azure tenant ID for organisational accounts. The client secret is prompted during `auth.sh` and stored in the OS keychain — it is never written to disk.

## Project Structure

```
.claude/skills/                          # 18 granular skill folders
  outlook-base/SKILL.md                  # Shared: proxy patterns, errors
  outlook-auth/SKILL.md                  # Authentication flow
  outlook-email-{list,read,send,reply,   # 7 email operation skills
    move,delete,organize}/SKILL.md
  outlook-calendar-{list,create,         # 4 calendar operation skills
    update,respond}/SKILL.md
  outlook-contacts-{list,manage}/SKILL.md # 2 contact operation skills
  outlook-folders/SKILL.md               # Folder management
  outlook-rules/SKILL.md                 # Inbox rules
  outlook-categories/SKILL.md            # Categories
  outlook-references/                    # Shared YAML references
    timezones.yaml                       # IANA timezone values
    colors.yaml                          # Category color presets
    errors.yaml                          # HTTP error codes
    graph-api-patterns.yaml              # Pagination, throttling, best practices

outlook-skills/                          # Python auth system
  auth.sh                                # Entry point — sets up venv, runs auth_runner.py
  auth_runner.py                         # OAuth 2.0 + PKCE flow
  token_helper.py                        # Token decryption, refresh, session enforcement

scripts/
  graph_call.py                          # Secure Graph API proxy (injects Bearer token internally)

setup/
  install.sh                             # macOS / Linux / WSL installer
  install.ps1                            # Windows PowerShell installer
  package.sh                             # builds distributable zip (macOS / Linux / WSL)
  package.ps1                            # builds distributable zip (Windows PowerShell)

CLAUDE.md                                # Project context for Claude Code
```

Each skill folder contains a lean `SKILL.md` (~40-60 lines) plus adjacent `reference.md` and optional `params.yaml` for progressive loading.

## Authentication

Tokens are encrypted with AES-256 Fernet and stored at `~/.skills/tokens.enc`. The encryption key is kept separately in the OS keychain. Tokens are refreshed automatically when expired. Re-authentication is only needed after the 30-day session limit or if the refresh token is revoked.

To check your authentication status:
```bash
bash ~/.skills/outlook-mcp/outlook-skills/auth.sh --status
```

To force re-authentication:
```bash
bash ~/.skills/outlook-mcp/outlook-skills/auth.sh --reauth
```

## Safety

- Destructive operations (send email, delete events, create rules) always require your confirmation before executing
- Tokens are never displayed in output or passed through Claude
- The client secret is stored exclusively in the OS keychain — never in files or environment variables
- All Graph API calls are gated behind `graph_call.py`; Claude cannot bypass it to access tokens directly

## Institutional/Organisational Accounts

For Microsoft 365 accounts from an organisation:
1. Find your Tenant ID: Azure Portal > Azure Active Directory > Overview
2. Set `"tenant_id": "your-tenant-id"` in `~/.skills/config.json`

## Development

```bash
npm install          # install test dependencies (js-yaml)
npm test             # run all tests (273 tests; no auth required)
npm run test:static  # validate skill file structure
npm run test:unit    # unit tests
npm run test:eval    # skill selection / curl pattern eval
OUTLOOK_INTEGRATION_TEST=true npm run test:integration  # live API smoke tests (requires valid token)
```

## License

MIT
