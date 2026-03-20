# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This project provides Claude Code skills for interacting with Microsoft Outlook (email, calendar, contacts, folders, rules, categories) via the Microsoft Graph API.

Instead of an MCP server, this project uses **skill files** that teach Claude how to call the Microsoft Graph API directly. Instead of curl commands with exposed tokens, all Microsoft Graph API calls go through `scripts/graph_call.py` — a secure Python proxy that handles token acquisition internally. Tokens are encrypted at rest using AES-256 Fernet and stored in the OS keychain (Windows Credential Manager / macOS Keychain).

**Progressive loading**: Each `SKILL.md` is lean (~40-60 lines) with only the core operation. Adjacent `reference.md` files contain parsing templates, advanced patterns, and error handling. `params.yaml` files provide YAML-formatted parameter options (showAs, importance, recurrence, etc.). Shared YAML files in `outlook-references/` are cross-referenced by multiple skills.

```
.claude/skills/
  outlook-base/              — Shared token/curl patterns; NOT user-invocable
  outlook-auth/              — OAuth flow (/outlook-auth)
  outlook-email-{list,read,send,reply,move,delete,organize}/
  outlook-calendar-{list,create,update,respond}/
  outlook-contacts-{list,manage}/
  outlook-{folders,rules,categories}/
  outlook-references/        — Shared YAML data (no SKILL.md): timezones, colors, errors, graph-api-patterns

scripts/
  graph_call.py              — Secure Graph API proxy (handles auth internally)
  outlook-auth-server.js     — DEPRECATED: OAuth callback server (replaced by auth.sh)
  outlook-token-refresh.js   — DEPRECATED: Token refresh (replaced by token_helper.py)

test/
  static/    — Structural lint of skill files (no auth needed)
  unit/      — Node.js script unit tests (no auth needed)
  eval/      — Skill description / curl pattern assertions (no auth needed)
  integration/ — Live Graph API smoke tests (requires auth + env flag)
```

## Commands

```bash
npm install          # install dependencies (js-yaml, dotenv)
npm test             # run all tests (static + unit + eval; integration skipped by default)
npm run test:static  # validate skill file structure
npm run test:security # security-specific static checks
npm run test:unit    # test auth scripts
npm run test:eval    # skill selection / curl pattern eval
OUTLOOK_INTEGRATION_TEST=true npm run test:integration  # live API smoke tests (requires valid token)
```

## Setup

1. Run `bash setup/install.sh` (macOS/Linux/WSL) or `setup\install.ps1` (PowerShell)
2. Create `~/.skills/config.json` with `tenant_id` and `client_id` from your Azure AD app registration (use `outlook-skills/config.example.json` as template)
3. Run `bash ~/.skills/outlook-mcp/outlook-skills/auth.sh` — prompts for client secret (stored in OS keychain), opens browser for OAuth login; also creates `outlook-skills/.venv`
4. Run `npm install` to install test dependencies

Auth management commands:
```bash
bash ~/.skills/outlook-mcp/outlook-skills/auth.sh --status   # check token validity
bash ~/.skills/outlook-mcp/outlook-skills/auth.sh --reauth   # force re-authentication
```

## Skill File Conventions

Every skill folder under `.claude/skills/` (except `outlook-references`) must contain:
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

`outlook-references/` is a **data-only directory** — it has no `SKILL.md` and is cross-referenced by other skill files using relative paths.

## Key Conventions

- All API calls use `python3 scripts/graph_call.py METHOD "/endpoint" [body] [--header "K:V"]`
- Endpoints must start with `/me` or `/users/` — `graph_call.py` rejects anything else with a 400
- `graph_call.py` bootstraps its Python dependencies from `outlook-skills/.venv` (created by `auth.sh`); if missing, it returns a 500 with instructions to run `auth.sh`
- Tokens are encrypted at rest (AES-256) and stored in the OS keychain — never exposed to the LLM
- Response format: `{"status": N, "data": {...}}` — parse the `.data` field for the API response body
- **Destructive operations** (send email, delete, cancel event, create rules) always require explicit user confirmation before executing
- Always use `$select` to limit response fields; use `@odata.nextLink` for pagination (never `$skip`)
- Max 4 concurrent Outlook API requests (Graph throttling limit)
- Token is never displayed to the user

## Available Skills

| Domain | Slash Command | Auto-triggers On |
|---|---|---|
| Auth | `/outlook-auth` | "connect to Outlook", "sign in" |
| Email — List | `/outlook-email-list` | inbox, emails, unread, check mail, search |
| Email — Read | `/outlook-email-read` | read email, open email, show message |
| Email — Send | `/outlook-email-send` | send email, compose, write, draft |
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

| Variable | Required | Description |
|---|---|---|
| `OUTLOOK_CLIENT_ID` | Yes | Azure AD application client ID |
| `OUTLOOK_CLIENT_SECRET` | Keychain | Stored in OS keychain via auth setup — not in env vars |
| `OUTLOOK_TENANT_ID` | No | Tenant ID (defaults to `common` for personal accounts) |
| `MS_TENANT_ID` | No | Alternative tenant ID variable |
| `OUTLOOK_REDIRECT_URI` | No | OAuth redirect (default: `http://localhost:8400/callback`) |

## Security Architecture

Tokens are never exposed to the LLM. The security boundary works as follows:

1. **Auth**: `bash outlook-skills/auth.sh` runs the OAuth 2.0 + PKCE flow and stores encrypted tokens
2. **Encryption**: Tokens encrypted at rest with AES-256 Fernet; encryption key in OS keychain
3. **API calls**: `python3 scripts/graph_call.py METHOD "/endpoint"` — injects Bearer token internally, returns only JSON response
4. **LLM rule**: Never import `token_helper`, call the token acquisition function, or read token files directly

All skills must use `scripts/graph_call.py` for every Graph API call.
