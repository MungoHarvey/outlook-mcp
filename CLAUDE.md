# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This project is a **Claude Code plugin** providing skills for interacting with Microsoft Outlook (email, calendar, contacts, folders, rules, categories) via the Microsoft Graph API.

All Microsoft Graph API calls go through `scripts/graph_call.py` — a secure Python proxy that injects Bearer tokens internally. Tokens are stored in `outlook-skills/tokens.json` (gitignored) and never exposed to the LLM. Authentication is handled by `outlook-skills/auth-server.js` — a Node.js OAuth 2.0 server on port 8400.

**Progressive loading**: Each `SKILL.md` is lean (~40-60 lines) with only the core operation. Adjacent `reference.md` files contain parsing templates, advanced patterns, and error handling. `params.yaml` files provide YAML-formatted parameter options (showAs, importance, recurrence, etc.). Shared reference YAML (timezones, colors, errors, graph-api-patterns) lives **once** in `skills/outlook-base/references/`; other skills link to it via `../outlook-base/references/`.

```
.claude-plugin/
  plugin.json                  — Plugin manifest
.mcp.json                      — MCP server config for Claude Desktop / Cowork

skills/                        — 20 skill folders (plugin auto-discovers these)
  outlook-base/                — Shared patterns + canonical references/; NOT user-invocable
  outlook-setup/               — Guided first-time setup (/outlook-setup)
  outlook-auth/                — OAuth flow (/outlook-auth)
  outlook-email-{list,read,draft,send,reply,move,delete,organize}/
  outlook-calendar-{list,create,update,respond}/
  outlook-contacts-{list,manage}/
  outlook-{folders,rules,categories}/

scripts/
  graph_call.py                — Secure Graph API proxy (handles auth internally)

outlook-skills/                — Auth system
  auth-server.js               — Node.js OAuth 2.0 server (port 8400)
  auth.sh / auth.ps1           — Auth entry points
  token_helper.py              — Token loading, silent refresh, session enforcement
  scopes.json                  — Canonical OAuth scope list (single source of truth)
  .env.example                 — Credentials template (copy to .env)

mcp-server/                    — stdio MCP transport for Claude Desktop / Cowork
  src/{index,auth,graph}.js    — its own token + Graph proxy (mirrors graph_call.py)

test/
  static/    — Structural lint of skill files (no auth needed)
  eval/      — Skill description / API pattern assertions (no auth needed)
  node/      — Auth-server behavioral tests (spawns the server)
  python/    — graph_call.py + token_helper.py behavioral tests
  integration/ — Live Graph API smoke tests (requires auth + env flag)
```

## Commands

```bash
npm install          # install dependencies (js-yaml, dotenv)
npm test             # all tests: static + eval + node + python (integration self-skips)
npm run test:static  # validate skill file structure
npm run test:security # security-specific static checks (scans all skill files)
npm run test:eval    # skill selection / API pattern eval
npm run test:node    # auth-server behavioral tests
npm run test:python  # graph_call.py + token_helper.py behavioral tests
OUTLOOK_INTEGRATION_TEST=true npm run test:integration  # live API smoke tests (requires valid token)
```

## Installation

### As a Claude Code plugin (recommended)

```bash
cc --plugin-dir /path/to/outlook-mcp-skills
```

Skills are auto-discovered from `skills/` and paths resolve via `${CLAUDE_PLUGIN_ROOT}`.

### For Claude Desktop / Cowork (zip import)

```bash
bash setup/package.sh          # macOS/Linux
.\setup\package.ps1            # Windows
```

Produces `outlook-skills.zip` — import via Settings → Skills. Auth must be completed in the repo first.

## Setup

Auth data (`.env`, `tokens.json`) lives entirely within the cloned repo.
Authentication runs through Node (`auth-server.js`) — no Python venv is required
to authenticate. `token_helper.py` and `graph_call.py` use only the Python
standard library; if extra Python deps are ever needed, install them with
`pip install -r outlook-skills/requirements.txt`.

### macOS / Linux / WSL / Git Bash
```bash
# 1. Create credentials file (gitignored) and fill in your Azure app details
cp outlook-skills/.env.example outlook-skills/.env

# 2. Authenticate — runs the OAuth flow, stores tokens in outlook-skills/
bash outlook-skills/auth.sh

# 3. Install test dependencies
npm install
```

### Windows (PowerShell)
```powershell
# 1. Create credentials file (gitignored) and fill in your Azure app details
Copy-Item outlook-skills\.env.example outlook-skills\.env

# 2. Authenticate — runs the OAuth flow, stores tokens in outlook-skills\
.\outlook-skills\auth.ps1

# 3. Install test dependencies
npm install
```

Auth management:
```bash
bash outlook-skills/auth.sh --status   # check token validity
bash outlook-skills/auth.sh --reauth   # force re-authentication
```
```powershell
.\outlook-skills\auth.ps1 -Status   # check token validity
.\outlook-skills\auth.ps1 -Reauth   # force re-authentication
.\outlook-skills\auth.ps1 -Revoke   # revoke and delete all tokens
```

## Skill File Conventions

Every skill folder under `skills/` must contain:
- `SKILL.md` — lean entrypoint with YAML frontmatter
- `reference.md` — extended patterns, parsing templates, error handling

**SKILL.md frontmatter schema:**
```yaml
---
name: outlook-skill-name        # kebab-case, matches folder name
description: "..."              # must include trigger words Claude uses for auto-selection
user_invocable: true            # omit (or false) only for outlook-base and outlook-categories
---
```

Skills with complex parameter sets also have `params.yaml` (currently: `outlook-email-send`, `outlook-calendar-create`, `outlook-contacts-manage`).

Skills reference the API proxy via `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py` — this resolves at runtime to the plugin's install location.

## Key Conventions

- All API calls use `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py METHOD "/endpoint" [body] [--header "K:V"]`
- Endpoints must start with `/me` or `/users/` — `graph_call.py` rejects anything else with a 400
- `graph_call.py` runs on the Python standard library; it will use an existing `outlook-skills/.venv` if present, and on an import failure returns a 503 `import_error` with instructions to `pip install -r outlook-skills/requirements.txt`
- Tokens are stored in `outlook-skills/tokens.json` (gitignored) — never exposed to the LLM
- Response format: `{"status": N, "data": {...}}` — parse the `.data` field for the API response body
- **Destructive operations** (send email, delete, cancel event, create rules) always require explicit user confirmation before executing
- Always use `$select` to limit response fields; use `@odata.nextLink` for pagination (never `$skip`)
- Max 4 concurrent Outlook API requests (Graph throttling limit)
- Token is never displayed to the user

## Available Skills

| Domain | Slash Command | Auto-triggers On |
|---|---|---|
| Setup | `/outlook-setup` | "set up Outlook", "install Outlook skills", "first time setup" |
| Auth | `/outlook-auth` | "connect to Outlook", "sign in" |
| Email — List | `/outlook-email-list` | inbox, emails, unread, check mail, search |
| Email — Read | `/outlook-email-read` | read email, open email, show message |
| Email — Draft | `/outlook-email-draft` | draft email, save draft, compose later |
| Email — Send | `/outlook-email-send` | send email, compose, write |
| Email — Reply | `/outlook-email-reply` | reply, reply all, forward |
| Email — Move | `/outlook-email-move` | move email, file email |
| Email — Delete | `/outlook-email-delete` | delete email, trash |
| Email — Organize | `/outlook-email-organize` | mark read, categorize, flag |
| Calendar — List | `/outlook-calendar-list` | calendar, schedule, meetings today |
| Calendar — Create | `/outlook-calendar-create` | schedule meeting, create event, book |
| Calendar — Update | `/outlook-calendar-update` | reschedule, change meeting |
| Calendar — Respond | `/outlook-calendar-respond` | accept, decline, cancel meeting |
| Contacts — List | `/outlook-contacts-list` | contacts, address book, find contact |
| Contacts — Manage | `/outlook-contacts-manage` | add contact, update contact |
| Folders | `/outlook-folders` | mail folders, create folder |
| Rules | `/outlook-rules` | inbox rules, email automation |
| Categories | (auto only) | categories, labels, color tags |

## Environment Variables

All credentials are set in `outlook-skills/.env` (gitignored). Copy `.env.example` as a starting template.

| Variable | Required | Description |
|---|---|---|
| `OUTLOOK_CLIENT_ID` | Yes | Azure AD application client ID |
| `OUTLOOK_CLIENT_SECRET` | Yes | Azure AD application client secret |
| `OUTLOOK_TENANT_ID` | No | Tenant ID (defaults to `common` for personal accounts) |
| `OUTLOOK_REDIRECT_URI` | No | OAuth redirect (default: `http://localhost:8400/auth/callback`) |

## Security Architecture

Tokens are never exposed to the LLM. The security boundary works as follows:

1. **Auth**: `bash outlook-skills/auth.sh` runs the OAuth 2.0 flow via `auth-server.js` and stores tokens in `outlook-skills/tokens.json` (gitignored)
2. **Credentials**: `outlook-skills/.env` holds client credentials (gitignored); tokens include the client secret for silent refresh
3. **API calls**: `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py METHOD "/endpoint"` — injects Bearer token internally, returns only JSON response
4. **LLM rule**: Never import `token_helper`, call the token acquisition function, or read token files directly

All skills must use `${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py` for every Graph API call.
