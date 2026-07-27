# Outlook Skills Plugin Architecture — Design Specification

## Context

This project provides Claude Code skills for interacting with Microsoft Outlook via the Microsoft Graph API. The skills are lightweight markdown files that teach Claude the API patterns. All API calls go through `scripts/graph_call.py` — a Python proxy that handles auth internally.

The system works well in **Claude Code** (shell access, Python available). We now want to extend support to **Claude Desktop** (no shell) and **Claude Cowork** (has shell, but sandbox may lack Python/venv dependencies).

## Design Principles

1. **Skills are the intelligence layer** — they are never modified to accommodate infrastructure differences
2. **Progressive skill loading** — skills are discovered and loaded on demand, keeping context lightweight
3. **Separation of concerns** — auth/transport is separate from domain knowledge
4. **Minimal MCP footprint** — the MCP server is an auth proxy, not a reimplementation of skills as tools
5. **Shared token file** — one auth flow, one `tokens.json`, readable by both `graph_call.py` and the MCP server

## Current Project Structure

```
outlook-mcp-skills/
├── .claude-plugin/
│   └── plugin.json              # Existing plugin manifest
├── skills/                      # Skill files (canonical, auto-discovered by plugin)
│   └── outlook-*/               # 19 skill folders
│       ├── SKILL.md             # Lean entrypoint (~40-60 lines)
│       ├── reference.md         # Extended patterns, parsing templates
│       ├── params.yaml          # Parameter options (some skills)
│       ├── templates.md         # Rule templates (outlook-rules only)
│       └── references/          # Shared YAML (timezones, colors, errors, graph-api-patterns)
├── scripts/
│   └── graph_call.py            # Secure Graph API proxy (Python)
├── outlook-skills/
│   ├── auth-server.js           # OAuth 2.0 callback server (Node.js)
│   ├── auth.sh / auth.ps1       # Auth entry points
│   ├── token_helper.py          # Token load, refresh, session enforcement
│   ├── tokens.json              # Live tokens (gitignored)
│   └── .env                     # Azure credentials (gitignored)
├── setup/
│   ├── install.sh / install.ps1 # Install skills + rewrite paths
│   └── package.sh / package.ps1 # Package for Claude Desktop import
├── test/
│   ├── static/                  # Skill file structure validation
│   ├── unit/                    # Auth script unit tests
│   ├── eval/                    # Skill selection assertions
│   └── integration/             # Live Graph API smoke tests
├── CLAUDE.md
├── package.json
└── README.md
```

## Branch Strategy

All work lives on the `plugin-dev` branch, which covers both the Claude Code plugin conversion and the Desktop/Cowork MCP server addition.

### Branch: `plugin-dev` (from `outlook-skills`)

**Purpose**: Convert skills to a portable Claude Code plugin and add a minimal MCP server for Desktop/Cowork support.

**Target platforms**: Claude Code (terminal), Claude Desktop, Claude Cowork

**What changed**:
- Skills moved from `.claude/skills/` to `skills/` at repo root
- `${CLAUDE_PLUGIN_ROOT}` used for portable paths in skill files
- `.claude-plugin/plugin.json` manifest added
- `mcp-server/` added for Desktop/Cowork (two tools: `outlook_auth`, `outlook_api`)
- `.mcp.json` declares the stdio MCP server

---

## Branch 1: `plugin/claude-code`

### Overview

Package the existing project as a Claude Code plugin. This is a distribution mechanism — everything works as-is. The plugin wraps skills, `graph_call.py`, and auth scripts into a single installable unit.

### Plugin Structure

```
outlook-mcp-skills/              (repo root = plugin root)
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/                      # Skills directory (Claude Code reads from here)
│   └── outlook-*/               # 19 skill folders, unchanged
├── scripts/
│   └── graph_call.py            # API proxy, unchanged
├── outlook-skills/
│   ├── auth-server.js           # OAuth server, unchanged
│   ├── auth.sh / auth.ps1       # Auth entry points, unchanged
│   ├── token_helper.py          # Token management, unchanged
│   └── .env.example
├── CLAUDE.md                    # Claude Code project context
├── package.json
└── README.md
```

### Tasks

#### 1.1 Update plugin.json manifest

Update `.claude-plugin/plugin.json` to conform to the Claude Code plugin spec:

```json
{
  "name": "outlook-skills",
  "version": "2.0.0",
  "description": "Microsoft Outlook integration via Microsoft Graph API — email, calendar, contacts, folders, rules, and categories",
  "author": {
    "name": "MungoHarvey"
  },
  "homepage": "https://github.com/MungoHarvey/outlook-mcp"
}
```

No `.mcp.json` — Claude Code uses shell execution, not MCP.

#### 1.2 Verify skill file paths

Skills currently reference `python3 scripts/graph_call.py` with relative paths. As a plugin, Claude Code runs from the plugin directory, so relative paths should work. Verify that:

- `graph_call.py` is findable from the plugin root
- `token_helper.py` can locate `tokens.json` and `.env` relative to itself
- `auth.sh` / `auth.ps1` work when invoked from the plugin root

If paths break, add a `settings.json` to the plugin root that sets the working directory, or adjust `graph_call.py`'s path resolution (it already uses `Path(__file__).parent.parent` which should be correct).

#### 1.3 Move skills to plugin `skills/` directory

Claude Code plugins expect skills in a `skills/` directory at the plugin root. The project already has this — verify the plugin loader reads from `skills/` not `.claude/skills/`.

If Claude Code's plugin system uses `.claude/skills/` instead, keep both and ensure they're in sync (or symlinked).

#### 1.4 First-run auth command

Add a slash command for initial authentication:

```
commands/
  outlook-auth.md
```

```markdown
---
name: outlook-auth
description: "Authenticate with Microsoft Outlook. Run this first."
---

Run the OAuth authentication flow:

bash outlook-skills/auth.sh

Or on Windows PowerShell:

.\outlook-skills\auth.ps1

Check status: bash outlook-skills/auth.sh --status
Re-authenticate: bash outlook-skills/auth.sh --reauth
```

#### 1.5 CLAUDE.md updates

Ensure `CLAUDE.md` accurately reflects the plugin-based usage model. The existing `CLAUDE.md` is comprehensive — verify it doesn't reference deprecated paths.

#### 1.6 Test

- `npm test` — all existing tests pass
- Install the plugin locally: `claude plugin install --local /path/to/repo`
- Verify skills load: `/outlook-email-list` should trigger
- Verify API proxy: `python3 scripts/graph_call.py GET "/me"` returns user profile
- Verify auth: `bash outlook-skills/auth.sh --status` returns VALID

### Acceptance Criteria

- [ ] Plugin installs via `claude plugin install`
- [ ] All 19 skills discoverable and triggerable
- [ ] `graph_call.py` executes successfully from within plugin context
- [ ] Auth flow works (initial + refresh + status check)
- [ ] All existing tests pass
- [ ] No changes to any skill SKILL.md or reference.md files

---

## Branch 2: `plugin/desktop-cowork`

### Overview

Add a minimal MCP server that serves two purposes:
1. **Auth management** — OAuth browser flow, token refresh, status check
2. **API proxy** — accepts Graph API requests and returns responses (replaces `graph_call.py` for environments without shell/Python)

The skills are bundled unchanged. Claude reads the skills to learn *what* to call, then uses the MCP server's `outlook_api` tool to *execute* the call. This preserves the progressive skill loading architecture.

### Key Design Decision

The MCP server exposes exactly **two tools**:

| Tool | Purpose | Parameters |
|------|---------|------------|
| `outlook_auth` | Manage authentication | `action`: `status` \| `login` \| `reauth` |
| `outlook_api` | Execute Graph API calls | `method`, `endpoint`, `body?`, `headers?` |

This keeps the MCP context overhead to ~200 tokens (two tool schemas) instead of 2000+ tokens if every skill operation were its own tool. Claude's intelligence — guided by the skill files — constructs the right `outlook_api` call.

### Plugin Structure

```
outlook-mcp-skills/              (repo root = plugin root)
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (updated)
├── .mcp.json                    # Declares local MCP server
├── skills/                      # Skills directory, UNCHANGED from claude-code branch
│   └── outlook-*/               # 19 skill folders, identical
├── mcp-server/                  # NEW — minimal MCP server
│   ├── src/
│   │   ├── index.js             # MCP stdio server entry point
│   │   ├── auth.js              # OAuth flow + token management (ported from token_helper.py + auth-server.js)
│   │   └── graph.js             # Graph API proxy (ported from graph_call.py)
│   ├── package.json             # Server dependencies (@modelcontextprotocol/sdk)
│   └── README.md                # MCP server documentation
├── scripts/
│   └── graph_call.py            # Kept for Claude Code compatibility
├── outlook-skills/
│   ├── auth-server.js           # Kept for Claude Code compatibility
│   ├── auth.sh / auth.ps1       # Kept for Claude Code compatibility
│   ├── token_helper.py          # Kept for Claude Code compatibility
│   ├── tokens.json              # Shared token file — both MCP and graph_call.py read this
│   └── .env                     # Azure credentials (gitignored)
├── CLAUDE.md
├── package.json
└── README.md
```

### MCP Server Specification

#### `mcp-server/src/index.js` — Server Entry Point

```
Transport: stdio (standard for local Claude plugins)
Protocol: MCP v1
Tools: 2 (outlook_auth, outlook_api)
Resources: none
Prompts: none
```

Initialises the MCP server, registers the two tools, and starts listening on stdio.

#### `mcp-server/src/auth.js` — Authentication Module

Port the following from the existing codebase to pure Node.js:

| Source (Python/Node) | Target (Node.js) | Function |
|---|---|---|
| `token_helper.py: _load_tokens()` | `auth.js: loadTokens()` | Read `tokens.json` from disk |
| `token_helper.py: _save_tokens()` | `auth.js: saveTokens()` | Atomic write + file permissions |
| `token_helper.py: _refresh_access_token()` | `auth.js: refreshAccessToken()` | POST to Azure token endpoint |
| `token_helper.py: get_token()` | `auth.js: getToken()` | Load → check session → refresh if needed |
| `token_helper.py: get_session_info()` | `auth.js: getSessionInfo()` | Return status (no secrets) |
| `auth-server.js: exchangeCodeForTokens()` | `auth.js: startAuthFlow()` | Full OAuth browser flow |

**Token file location**: `{plugin_root}/outlook-skills/tokens.json` — same location as existing. The MCP server resolves this relative to its own `__dirname`.

**Token file format**: Identical to existing — `graph_call.py` and the MCP server read/write the same file:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "access_token_expires_at": 1711234567,
  "session_started_at": 1708642567,
  "scopes": ["Mail.Read", "..."],
  "user_email": "user@example.com",
  "tenant_id": "common",
  "client_id": "...",
  "client_secret": "..."
}
```

**Credentials**: Read from `{plugin_root}/outlook-skills/.env` using manual parsing (no dotenv dependency required — match the existing `auth-server.js` pattern).

**30-day session enforcement**: Identical to `token_helper.py` — if `session_started_at` is older than 30 days, require re-authentication.

#### `mcp-server/src/graph.js` — Graph API Proxy

Port the following from `graph_call.py` to Node.js:

| Function | Behaviour |
|---|---|
| `validateEndpoint(endpoint)` | Must start with `/me` or `/users/` |
| `makeRequest(method, endpoint, body, headers)` | Build URL, inject Bearer token, execute, parse response |
| Auto-retry on 401 | Refresh token, retry once |

**Response format**: Identical to `graph_call.py`:

```json
{"status": 200, "data": { "value": [...] }}
```

Or on error:

```json
{"status": 401, "error": "auth_required", "message": "Run auth flow"}
```

The MCP tool returns this JSON as a text content block so Claude can parse it in exactly the same way it parses `graph_call.py` output.

#### Tool Schemas

**`outlook_auth`**:

```json
{
  "name": "outlook_auth",
  "description": "Manage Microsoft Outlook authentication. Use 'status' to check if authenticated, 'login' for initial auth, 'reauth' to force a new login.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["status", "login", "reauth"],
        "description": "Auth action to perform"
      }
    },
    "required": ["action"]
  }
}
```

**`outlook_api`**:

```json
{
  "name": "outlook_api",
  "description": "Execute a Microsoft Graph API call. Handles authentication internally. Use this to interact with Outlook email, calendar, contacts, folders, and rules. Endpoints must start with /me or /users/.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "method": {
        "type": "string",
        "enum": ["GET", "POST", "PATCH", "DELETE"],
        "description": "HTTP method"
      },
      "endpoint": {
        "type": "string",
        "description": "Graph API endpoint, e.g. /me/messages?$select=id,subject&$top=10"
      },
      "body": {
        "type": "string",
        "description": "JSON request body for POST/PATCH (optional)"
      },
      "headers": {
        "type": "object",
        "description": "Additional headers, e.g. {\"Prefer\": \"outlook.timezone=\\\"Europe/London\\\"\"}",
        "additionalProperties": { "type": "string" }
      }
    },
    "required": ["method", "endpoint"]
  }
}
```

### `.mcp.json` — Server Declaration

```json
{
  "mcpServers": {
    "outlook": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp-server/src/index.js"],
      "env": {}
    }
  }
}
```

No environment variables passed — the server reads `.env` from its known relative path.

### Plugin Manifest

Update `.claude-plugin/plugin.json`:

```json
{
  "name": "outlook-desktop",
  "version": "2.0.0",
  "description": "Microsoft Outlook integration for Claude Desktop and Cowork — email, calendar, contacts, folders, rules, and categories via the Microsoft Graph API",
  "author": {
    "name": "MungoHarvey"
  },
  "homepage": "https://github.com/MungoHarvey/outlook-mcp"
}
```

### How Claude Uses It

The flow in Desktop/Cowork is:

1. **User**: "Check my inbox"
2. **Claude**: Reads `skills/outlook-email-list/SKILL.md` (discovers the endpoint pattern)
3. **Claude**: Calls MCP tool `outlook_api` with `method: "GET"`, `endpoint: "/me/messages?$select=id,subject,from,receivedDateTime,bodyPreview,isRead&$top=10&$orderby=receivedDateTime desc"`
4. **MCP server**: Injects Bearer token, calls `graph.microsoft.com`, returns `{status, data}`
5. **Claude**: Parses response using patterns from the skill's `reference.md`

The skill describes `python3 scripts/graph_call.py GET "/me/messages?..."` — Claude adapts this to the available execution path (shell command in Claude Code, MCP tool in Desktop/Cowork). No skill modification needed.

### How Auth Works

**First run**:
1. User installs plugin
2. User creates `outlook-skills/.env` with Azure credentials (or plugin setup guide walks them through it)
3. Claude (or user) calls `outlook_auth` with `action: "login"`
4. MCP server starts HTTP listener on port 8400, opens browser to Microsoft login
5. User authenticates, callback exchanges code for tokens
6. Tokens saved to `outlook-skills/tokens.json`
7. MCP server shuts down the HTTP listener, returns success

**Subsequent sessions**:
1. Claude calls `outlook_api` with the desired endpoint
2. MCP server loads tokens from `tokens.json`
3. If access token expired → silent refresh via Azure token endpoint
4. If refresh token expired or session >30 days → returns `auth_required` error
5. Claude tells user to re-authenticate

**Cross-mode compatibility**: If the user has already authenticated via Claude Code (`auth.sh`), the tokens are in the same `tokens.json` — the MCP server picks them up automatically. No duplicate auth needed.

### Tasks

#### 2.1 Create `mcp-server/` directory structure

```
mcp-server/
├── src/
│   ├── index.js
│   ├── auth.js
│   └── graph.js
├── package.json
└── README.md
```

#### 2.2 Implement `auth.js`

Port from `token_helper.py` + `auth-server.js`. Pure Node.js, zero dependencies beyond `@modelcontextprotocol/sdk`. Use `node:https`, `node:http`, `node:fs`, `node:path`, `node:url`, `node:querystring`.

Key behaviours to port:
- Load/save tokens with atomic write
- Silent refresh via Azure token endpoint
- 30-day session enforcement
- OAuth browser flow (HTTP server on port 8400, redirect to Microsoft, callback exchange)
- `.env` file parsing (manual, no dotenv)
- File permission setting (platform-aware: `icacls` on Windows, `chmod 600` on Unix)

#### 2.3 Implement `graph.js`

Port from `graph_call.py`. Key behaviours:
- Endpoint validation (`/me` or `/users/` prefix)
- Request construction with Bearer token injection
- Auto-retry on 401 (refresh + single retry)
- Response normalisation to `{status, data}` or `{status, error, message}`
- Content-Type header for POST/PATCH
- Custom header pass-through

#### 2.4 Implement `index.js`

MCP server with stdio transport. Register two tools. Route calls to `auth.js` and `graph.js`.

Use `@modelcontextprotocol/sdk` for the server framework. Minimal implementation — no resources, no prompts, no subscriptions.

#### 2.5 Create `.mcp.json`

Declare the local stdio server as shown above.

#### 2.6 Create `mcp-server/package.json`

```json
{
  "name": "outlook-mcp-server",
  "version": "1.0.0",
  "description": "Minimal MCP server for Outlook Graph API authentication and proxying",
  "main": "src/index.js",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### 2.7 Add setup/first-run instructions

Create or update the skill `skills/outlook-auth/SKILL.md` to include a note about Desktop/Cowork auth:

> In Claude Desktop or Cowork, authentication is managed by the MCP server. Use the `outlook_auth` tool with action `status`, `login`, or `reauth`. In Claude Code, use `bash outlook-skills/auth.sh` as before.

This is the ONLY skill file change — a non-breaking addendum to the auth skill, which is specifically about authentication.

#### 2.8 Test the MCP server

Create `mcp-server/test/` with:

- **Unit tests**: `auth.test.js` — token loading, refresh logic, session enforcement (mocked HTTP)
- **Unit tests**: `graph.test.js` — endpoint validation, request construction, error handling
- **Integration test**: `server.test.js` — start server via stdio, call both tools, verify responses

Also verify that:
- Existing `graph_call.py` still reads the same `tokens.json` correctly
- Auth via Claude Code (`auth.sh`) produces tokens the MCP server can use
- Auth via MCP server produces tokens `graph_call.py` can use

### Acceptance Criteria

- [ ] MCP server starts via `node mcp-server/src/index.js` on stdio
- [ ] `outlook_auth status` returns session info when tokens exist
- [ ] `outlook_auth login` opens browser, completes OAuth, saves tokens
- [ ] `outlook_api GET /me` returns user profile when authenticated
- [ ] `outlook_api GET /me/messages?$top=5` returns email list
- [ ] Auto-refresh works when access token is expired
- [ ] `auth_required` returned when session >30 days or no tokens
- [ ] `tokens.json` is read/write compatible with `graph_call.py`
- [ ] Plugin installs in Claude Desktop via plugin system
- [ ] Skills load and are discoverable in Desktop/Cowork
- [ ] All 19 skill files are UNCHANGED from the claude-code branch
- [ ] MCP server has zero impact on Claude Code usage (MCP only activates in Desktop/Cowork)

---

## Shared Across Both Branches

### Skill Files

The 19 skill folders in `skills/` are **identical** on both branches. They must not diverge. Any skill improvements should be made on `main` and merged into both branches.

### Token File

`outlook-skills/tokens.json` — same format, same location, same file. Written by whichever auth mechanism runs first, readable by both.

### Azure Credentials

`outlook-skills/.env` — same format:

```
OUTLOOK_CLIENT_ID=your-client-id
OUTLOOK_CLIENT_SECRET=your-secret-value
OUTLOOK_TENANT_ID=common
```

### Git Strategy

```
outlook-skills   (original skills branch)
└── plugin-dev   (plugin conversion + MCP server)
```

Skill improvements should be made on `outlook-skills` and merged into `plugin-dev`. The `plugin-dev` branch is the primary distribution branch.

---

## Implementation Order

### Phase 1: Claude Code plugin (branch `plugin/claude-code`)

1. Update `plugin.json` manifest
2. Verify skill paths work in plugin context
3. Add `/outlook-auth` command
4. Test plugin installation + skill discovery
5. Test auth flow + API calls end-to-end

**Estimated effort**: Small — mostly packaging and verification.

### Phase 2: Desktop/Cowork plugin (branch `plugin/desktop-cowork`)

1. Create `mcp-server/` directory + `package.json`
2. Implement `auth.js` (port from Python/Node)
3. Implement `graph.js` (port from Python)
4. Implement `index.js` (MCP server with two tools)
5. Create `.mcp.json`
6. Test MCP server standalone (stdio)
7. Test plugin installation in Claude Desktop
8. Test cross-mode auth compatibility (tokens shared)
9. End-to-end: skill discovery → API call → response parsing

**Estimated effort**: Medium — new MCP server code, but logic is a port of existing well-tested Python/Node.

### Phase 3: Distribution

1. Publish Claude Code plugin to marketplace (or GitHub)
2. Publish Desktop/Cowork plugin to marketplace (or GitHub)
3. Update project README with dual installation paths
4. Update setup/README.md with platform-specific guidance

---

## Security Considerations

These carry forward from the existing architecture:

1. **Tokens never exposed to Claude** — the MCP server injects the Bearer token internally, just like `graph_call.py`
2. **Destructive operations require confirmation** — skills instruct Claude to confirm before send/delete/cancel (this is a skill-level concern, unchanged)
3. **HTML email sanitisation** — skills instruct Claude to strip HTML before presenting email bodies (skill-level concern, unchanged)
4. **Endpoint validation** — both `graph_call.py` and `graph.js` reject endpoints not starting with `/me` or `/users/`
5. **File permissions** — `tokens.json` is written with restricted permissions (600 on Unix, ACL on Windows)
6. **`.env` and `tokens.json` are gitignored** — credentials never committed
7. **Max 4 concurrent requests** — respect Graph API throttling limits (documented in skills)

---

## Open Questions

1. **Cowork shell access**: Can Cowork's sandbox run `python3 scripts/graph_call.py` directly? If yes, the Desktop/Cowork plugin may only need the MCP auth tool (not the API proxy) when running in Cowork — Claude would use the shell for API calls and MCP only for auth. Worth testing empirically.

2. **Plugin auto-install of npm dependencies**: Does the plugin system run `npm install` in `mcp-server/` automatically, or does the user need to do this? If manual, add to the setup instructions.

3. **MCP server lifecycle**: Does Claude Desktop keep the MCP server process alive between conversations, or restart it each time? This affects whether the OAuth HTTP listener needs to be persistent or one-shot.

4. **Plugin marketplace**: Are there separate marketplaces for Claude Code vs Desktop/Cowork plugins, or one marketplace with platform targeting?
