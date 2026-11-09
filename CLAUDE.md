# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This project is a **Claude Code plugin** providing skills for interacting with Microsoft Outlook (email, calendar, contacts, folders, rules, categories) via the Microsoft Graph API.

All Microsoft Graph API calls go through `scripts/graph_call.py` — a secure Python proxy that injects Bearer tokens internally. Tokens are stored in the auth state directory (see Setup; `~/.outlook-skills/tokens.json` by default, `outlook-skills/tokens.json` only in the legacy cloned-repo layout) and never exposed to the LLM. Authentication is handled by `outlook-skills/auth-server.js` — a Node.js OAuth 2.0 server on port 8400.

**Progressive loading**: Each `SKILL.md` is lean (~40-60 lines) with only the core operation. Adjacent `reference.md` files contain parsing templates, advanced patterns, and error handling. `params.yaml` files provide YAML-formatted parameter options (showAs, importance, recurrence, etc.). Shared reference YAML (timezones, colors, errors, graph-api-patterns) lives **once** in `skills/outlook-base/references/`; other skills link to it via `../outlook-base/references/`.

```
.claude-plugin/
  plugin.json                  — Plugin manifest
  marketplace.json             — Repo-as-marketplace manifest

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

From the marketplace (the repo is its own marketplace via `.claude-plugin/marketplace.json`):

```
/plugin marketplace add MungoHarvey/outlook-mcp
/plugin install outlook-skills@outlook-mcp
```

Or from a local clone:

```bash
claude --plugin-dir /path/to/outlook-mcp
```

Skills are auto-discovered from `skills/` and paths resolve via `${CLAUDE_PLUGIN_ROOT}`.

### For Claude Desktop / Cowork (zip import)

```bash
bash setup/package.sh          # macOS/Linux
.\setup\package.ps1            # Windows
```

Produces `outlook-skills.zip` — import via Settings → Skills. Auth must be completed in the repo first.

## Setup

Auth state (`.env` and tokens) is resolved by every component (`token_helper.py`, `graph_call.py`, `auth-server.js`, the MCP server) in this order:

1. `$OUTLOOK_SKILLS_HOME`, if set and non-empty: a leading `~` is expanded and the path is made absolute.
2. Otherwise `~/.outlook-skills` (Windows: `%USERPROFILE%\.outlook-skills`), if it holds a `.env` or `tokens.json` **file**.
3. Otherwise the plugin's own `outlook-skills/` folder, **only if it holds `tokens.json`**. This is the legacy cloned-repo layout; a `.env` alone there no longer counts.
4. Otherwise `~/.outlook-skills`, where new state is created.

`$OUTLOOK_TOKEN_FILE` overrides only the token file. `.env` is read only from the chosen directory.

To see the result, run `--where` (paths only, no secrets): it prints the chosen directory, the token file and the checked directories.
```bash
python outlook-skills/token_helper.py --where
node outlook-skills/auth-server.js --where
bash outlook-skills/auth.sh --where
```
```powershell
powershell -NoProfile -File "<path>\outlook-skills\auth.ps1" -Where
```

On Windows, run the `.ps1` launcher from PowerShell; never `bash` from PowerShell, which runs WSL, and WSL cannot read Windows paths.

Already have credentials in the repo's `outlook-skills/`? See [Moving existing credentials to `~/.outlook-skills`](README.md#moving-existing-credentials-to-outlook-skills).

Authentication runs through Node (`auth-server.js`) — no Python venv is required to authenticate. `token_helper.py` and `graph_call.py` use only the Python standard library.

### macOS / Linux / WSL / Git Bash
```bash
# 1. Create the state directory and credentials file, then fill in your Azure app details
# (already have a working Azure app? copy your existing .env here instead)
mkdir -p ~/.outlook-skills && chmod 700 ~/.outlook-skills
cp -n outlook-skills/.env.example ~/.outlook-skills/.env

# 2. Authenticate — runs the OAuth flow, stores tokens in ~/.outlook-skills/
bash outlook-skills/auth.sh

# 3. Install test dependencies
npm install
```

### Windows (PowerShell)
```powershell
# 1. Create the state directory and credentials file, then fill in your Azure app details
# (already have a working Azure app? copy your existing .env here instead)
New-Item -ItemType Directory -Force "$env:USERPROFILE\.outlook-skills" | Out-Null
Copy-Item outlook-skills\.env.example "$env:USERPROFILE\.outlook-skills\.env"

# 2. Authenticate — runs the OAuth flow, stores tokens in %USERPROFILE%\.outlook-skills\
.\outlook-skills\auth.ps1

# 3. Install test dependencies
npm install
```

Auth management:
```bash
bash outlook-skills/auth.sh --status   # check token validity
bash outlook-skills/auth.sh --reauth   # force re-authentication
bash outlook-skills/auth.sh --revoke   # revoke and delete all tokens
bash outlook-skills/auth.sh --where    # print the state directory lookup (paths only)
```
```powershell
.\outlook-skills\auth.ps1 -Status   # check token validity
.\outlook-skills\auth.ps1 -Reauth   # force re-authentication
.\outlook-skills\auth.ps1 -Revoke   # revoke and delete all tokens
.\outlook-skills\auth.ps1 -Where    # print the state directory lookup (paths only)
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
---
```

Only `name` and `description` are used — Claude Code has no user-invocability frontmatter key. Skills not meant for direct invocation (`outlook-base`, `outlook-categories`) say so in their `description`; `test/static/skill-structure.test.js` guards against the legacy `user_invocable` key reappearing.

Skills with complex parameter sets also have `params.yaml` (currently: `outlook-email-send`, `outlook-calendar-create`, `outlook-contacts-manage`).

Skills reference the API proxy via `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py` — this resolves at runtime to the plugin's install location.

## Key Conventions

- All API calls use `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py METHOD "/endpoint" [body] [--header "K:V"]`
- Endpoints must start with `/me` or `/users/` — `graph_call.py` rejects anything else with a 400
- `graph_call.py` runs on the Python standard library; it will use an existing `.venv` if present (searched in its own order: `$OUTLOOK_SKILLS_HOME/.venv`, the plugin's `outlook-skills/.venv`, then `~/.outlook-skills/.venv`), and on an import failure returns a 503 `import_error` naming the auth command to run
- Tokens are stored in the auth state directory (`tokens.json`, owner-only permissions, gitignored) — never exposed to the LLM
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

All credentials are set in the state directory's `.env` (never committed). Copy `.env.example` as a starting template.

| Variable | Required | Description |
|---|---|---|
| `OUTLOOK_CLIENT_ID` | Yes | Azure AD application client ID |
| `OUTLOOK_CLIENT_SECRET` | Yes | Azure AD application client secret |
| `OUTLOOK_TENANT_ID` | No | Tenant ID (defaults to `common` for personal accounts) |
| `OUTLOOK_REDIRECT_URI` | No | OAuth redirect (default: `http://localhost:8400/auth/callback`) |

Process-level overrides (not set in `.env`):

| Variable | Description |
|---|---|
| `OUTLOOK_SKILLS_HOME` | Override the auth state directory (`.env`, `tokens.json`; also the first `.venv` location `graph_call.py` checks) |
| `OUTLOOK_TOKEN_FILE` | Override just the token file path |

## Security Architecture

Tokens are never exposed to the LLM. The security boundary works as follows:

1. **Auth**: `bash outlook-skills/auth.sh` (Windows: `powershell -NoProfile -File "<path>\outlook-skills\auth.ps1"`) runs the OAuth 2.0 flow via `auth-server.js` and stores tokens in the state directory's `tokens.json` (gitignored)
2. **Credentials**: the state directory's `.env` holds client credentials (gitignored); the client secret is NOT persisted in `tokens.json` — silent refresh reads it from `.env`
3. **API calls**: `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py METHOD "/endpoint"` — injects Bearer token internally, returns only JSON response
4. **LLM rule**: Never import `token_helper`, call the token acquisition function, or read token files directly

All skills must use `${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py` for every Graph API call.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on MungoHarvey/outlook-mcp (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
