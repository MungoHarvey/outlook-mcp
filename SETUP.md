# Outlook MCP Skills — Setup Guide

## Architecture Overview

This project provides Microsoft Outlook integration for Claude via two cooperating layers:

1. **Skills Plugin** (`.plugin` file) — Contains 19 skill definitions that teach Claude *how* to interact with the Microsoft Graph API (which endpoints to call, what parameters to use, how to interpret responses). Installed by drag-and-drop into Claude Desktop / Cowork.

2. **MCP Server** (`claude_desktop_config.json`) — A lightweight Node.js stdio server running on the host machine that provides two tools: `outlook_auth` (authentication management) and `outlook_api` (Graph API proxy). Registered in Claude Desktop's configuration file alongside other local MCP servers.

### Why Two Layers?

The Claude Desktop / Cowork environment uses a sandboxed Linux VM for code execution. This VM cannot make arbitrary outbound HTTPS requests (the HTTP proxy blocks CONNECT tunnels to external domains). Local MCP servers declared in `claude_desktop_config.json` run on the **host machine** (Windows/macOS), outside the sandbox, and can therefore reach `https://graph.microsoft.com` and `https://login.microsoftonline.com` without restriction.

This is the same pattern used by every other local MCP server — `filesystem`, `obsidian`, and `GitLab` are all declared in `claude_desktop_config.json`, not bundled inside plugins.

The skills remain in a separate `.plugin` file because they are pure knowledge (markdown files). They contain no executable code and work perfectly as an uploaded plugin. When Claude reads a skill, it learns what Graph API call to make, then uses the `outlook_api` MCP tool to execute it.

### Data Flow

```
User request
  → Claude reads relevant skill (e.g. outlook-email-list)
  → Skill instructs Claude to call outlook_api with GET /me/messages
  → MCP server (host machine) attaches OAuth token, calls Graph API
  → Response returned to Claude
  → Claude formats and presents results
```

---

## Prerequisites

- **Node.js** >= 18.0.0 (verify: `node --version`)
- **npm** (bundled with Node.js)
- **Claude Desktop** installed
- **Microsoft 365 account** with appropriate permissions
- The outlook-mcp-skills repository cloned/downloaded to a known location

---

## Step 1: Install MCP Server Dependencies

The MCP server lives at `mcp-server/` within the project. It needs its npm dependencies installed on the host machine.

```bash
cd <path-to-outlook-mcp-skills>/mcp-server
npm install
```

This installs `@modelcontextprotocol/sdk` and `zod` — the only two dependencies.

### Verify Installation

```bash
node src/index.js
```

The server should start silently (no output, no errors) and wait for MCP messages on stdin. Press `Ctrl+C` to stop.

---

## Step 2: Install the Skills Plugin

The skills-only plugin (`.plugin` file) contains 19 outlook skill definitions, the `plugin.json` manifest, and a `README.md`. It does **not** contain `node_modules` or the MCP server code.

### Building the Plugin

The plugin must be built with **forward-slash path separators** (POSIX). PowerShell's `Compress-Archive` creates backslash paths which are rejected by the Cowork upload validator. Use one of:

**Option A — Linux/macOS `zip` command** (recommended):

```bash
cd /path/to/outlook-mcp-skills
zip -r outlook-skills.plugin .claude-plugin/ skills/ README.md
```

**Option B — From within a Cowork session** (Linux VM):

```bash
# Copy relevant directories to /tmp, then:
cd /tmp/outlook-clean
zip -r /path/to/output/outlook-skills.plugin .claude-plugin/ skills/ README.md
```

**Option C — Python** (cross-platform, preserves forward slashes):

```python
import zipfile, os

src = r"<path-to-outlook-mcp-skills>"   # e.g. r"C:\Users\you\Documents\outlook-mcp-skills"
out = r"<output-path>\outlook-skills.plugin"  # e.g. r"C:\Users\you\Documents\outlook-skills.plugin"

include_dirs = {".claude-plugin", "skills"}
include_files = {"README.md"}

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        rel_root = os.path.relpath(root, src).replace("\\", "/")
        top = rel_root.split("/")[0]
        if top == ".":
            for f in files:
                if f in include_files:
                    zf.write(os.path.join(root, f), f)
        elif top in include_dirs:
            for f in files:
                arc_path = f"{rel_root}/{f}"
                zf.write(os.path.join(root, f), arc_path)
```

### Installing the Plugin

1. Open Claude Desktop
2. Drag and drop the `.plugin` file onto the Claude Desktop window, or use Settings > Plugins > "My Uploads" > upload
3. All 19 outlook skills should appear in the skill list

### What the Plugin Contains

| Directory | Contents |
|-----------|----------|
| `.claude-plugin/plugin.json` | Plugin metadata (name, version, description, author) |
| `skills/outlook-auth/` | Authentication skill |
| `skills/outlook-base/` | Shared foundation (token patterns, curl, error handling) |
| `skills/outlook-email-list/` | List and search emails |
| `skills/outlook-email-read/` | Read specific email by ID |
| `skills/outlook-email-send/` | Compose and send emails |
| `skills/outlook-email-draft/` | Create email drafts |
| `skills/outlook-email-reply/` | Reply, reply-all, forward |
| `skills/outlook-email-delete/` | Delete emails |
| `skills/outlook-email-move/` | Move emails between folders |
| `skills/outlook-email-organize/` | Mark read/unread, categorise, flag |
| `skills/outlook-calendar-list/` | List calendar events |
| `skills/outlook-calendar-create/` | Create events and meetings |
| `skills/outlook-calendar-update/` | Modify existing events |
| `skills/outlook-calendar-respond/` | Accept/decline invitations |
| `skills/outlook-contacts-list/` | List and search contacts |
| `skills/outlook-contacts-manage/` | Create and update contacts |
| `skills/outlook-folders/` | Manage mail folders |
| `skills/outlook-categories/` | List categories and colour presets |
| `skills/outlook-rules/` | Manage inbox rules |

---

## Step 3: Register the MCP Server

The MCP server must be declared in Claude Desktop's configuration file. This is a one-time setup step.

### Configuration File Location

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

### What We Are Adding

A single `"outlook"` entry inside the existing `"mcpServers"` object:

```json
"outlook": {
  "command": "node",
  "args": ["<path-to>/mcp-server/src/index.js"],
  "env": {
    "OUTLOOK_TOKEN_FILE": "<path-to>/outlook-skills/tokens.json"
  }
}
```

This tells Claude Desktop to launch `node mcp-server/src/index.js` as a stdio MCP server, passing the token file location as an environment variable. The server exposes two tools:

- **`outlook_auth`** — Check auth status, initiate login, or force re-authentication
- **`outlook_api`** — Proxy authenticated requests to the Microsoft Graph API

### Recommended: Manual Edit

The safest approach is to open the config file in a text editor and add the entry directly. This avoids the well-known problem where PowerShell's `ConvertFrom-Json` / `ConvertTo-Json` pipeline silently corrupts nested JSON structures, flattens objects, and strips values it cannot round-trip cleanly.

**Windows:**
```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

**macOS:**
```bash
open -a TextEdit "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
```

**Linux:**
```bash
xdg-open "$HOME/.config/Claude/claude_desktop_config.json"
# or: nano, vim, code, etc.
```

Find the last entry inside `"mcpServers": { ... }`, add a trailing comma after its closing `}`, then paste the outlook block. For example, if your last existing server is `obsidian`:

```json
    "obsidian": {
      "command": "npx",
      "args": ["@mauricio.wolff/mcp-obsidian@latest", "..."]
    },
    "outlook": {
      "command": "node",
      "args": ["<absolute-path-to>/mcp-server/src/index.js"],
      "env": {
        "OUTLOOK_TOKEN_FILE": "<absolute-path-to>/outlook-skills/tokens.json"
      }
    }
```

Replace `<absolute-path-to>` with the full path to your `outlook-mcp-skills` directory. On Windows, use double backslashes in JSON strings (e.g. `C:\\Users\\you\\Documents\\...`). On macOS/Linux, use forward slashes.

Save the file. That's it.

### Scripted Alternative: bash with jq (macOS/Linux only)

If you prefer a script, `jq` is safe for JSON manipulation (unlike PowerShell). Install with `brew install jq` (macOS) or `apt install jq` (Ubuntu/Debian):

```bash
# Set paths — adjust for your system
CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
# Linux: CONFIG="$HOME/.config/Claude/claude_desktop_config.json"

MCP_INDEX="$HOME/Documents/Agents/MCPs/outlook-agent/outlook-mcp-skills/mcp-server/src/index.js"
TOKEN_FILE="$HOME/Documents/Agents/MCPs/outlook-agent/outlook-mcp-skills/outlook-skills/tokens.json"

# Backup first
cp "$CONFIG" "$CONFIG.backup.$(date +%Y%m%d-%H%M%S)"

# Add the outlook entry, preserving everything else
jq --arg idx "$MCP_INDEX" --arg tok "$TOKEN_FILE" \
  '.mcpServers.outlook = {
    "command": "node",
    "args": [$idx],
    "env": {
      "OUTLOOK_TOKEN_FILE": $tok
    }
  }' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"

echo "Outlook MCP server added. Restart Claude Desktop to activate."
```

### Warning: Do Not Use PowerShell JSON Round-Tripping

PowerShell's `ConvertFrom-Json | ConvertTo-Json` pipeline is **not safe** for editing `claude_desktop_config.json`. It silently mangles nested structures, can remove existing MCP server entries, and produces output that Claude Desktop cannot parse correctly. Always edit this file manually on Windows, or use `jq` from Git Bash / WSL.

### Verify the Configuration

After editing, the `mcpServers` section should contain an `outlook` entry alongside your existing servers. Validate the JSON is well-formed:

**Windows (PowerShell):**
```powershell
Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" -Raw | ConvertFrom-Json | Out-Null
# No output = valid JSON. An error means a syntax problem (likely a missing comma).
```

**macOS/Linux:**
```bash
jq . "$HOME/Library/Application Support/Claude/claude_desktop_config.json" > /dev/null
# No output = valid JSON.
```

---

## Step 4: Restart and Test

1. **Quit Claude Desktop completely** (system tray > Exit, not just close window)
2. **Relaunch Claude Desktop**
3. **Start a new Cowork session**

### Verification Checklist

**Skills loaded?** — Check that outlook skills appear in the available skills list. You should see entries like `outlook-skills:outlook-email-list`, `outlook-skills:outlook-calendar-list`, etc.

**MCP tools available?** — In the new session, ask Claude:
> "What outlook tools do you have available?"

Claude should report `outlook_auth` and `outlook_api` as available MCP tools.

**Authentication test:**
> "Check my Outlook authentication status"

This triggers the `outlook-auth` skill which calls `outlook_auth` with action `"status"`.

**End-to-end test:**
> "Show me my recent emails"

This triggers `outlook-email-list`, which instructs Claude to call `outlook_api` with `GET /me/messages`.

---

## Authentication

The MCP server uses Azure AD OAuth 2.0 with the device code flow.

### Initial Setup

1. Ask Claude to check Outlook auth status — it will report "not authenticated"
2. Ask Claude to log in — the `outlook_auth` tool with action `"login"` will return a device code and URL
3. Open the URL in your browser, enter the code, and sign in with your Microsoft 365 account
4. Once authenticated, tokens are saved to `tokens.json`

### Token Lifecycle

- **Access tokens** expire after ~1 hour and are refreshed automatically
- **Refresh tokens** are long-lived but the server enforces a **30-day session limit**
- After 30 days, you will need to re-authenticate (action `"reauth"`)
- The `tokens.json` file is shared between the Python CLI tools and the Node.js MCP server

### Azure AD Configuration

| Parameter | Value |
|-----------|-------|
| Client ID | (from your Azure App Registration — see `outlook-skills/.env`) |
| Tenant ID | (from your Azure App Registration — see `outlook-skills/.env`) |
| Token endpoint | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |

---

## MCP Server Reference

### `outlook_auth`

Manages authentication state.

| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `action` | enum | `status`, `login`, `reauth` | What to do |

**`status`** — Returns current auth state, token expiry, session age.
**`login`** — Initiates device code flow if not authenticated.
**`reauth`** — Forces re-authentication (clears existing tokens).

### `outlook_api`

Proxies authenticated requests to Microsoft Graph API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `method` | enum | Yes | `GET`, `POST`, `PATCH`, `DELETE`, `PUT` |
| `endpoint` | string | Yes | Graph API path (must start with `/me` or `/users/`) |
| `body` | string | No | JSON request body (for POST/PATCH/PUT) |
| `headers` | object | No | Additional HTTP headers |

**Security constraints:**
- Endpoints must begin with `/me` or `/users/` (no arbitrary Graph API access)
- 30-second request timeout
- Automatic 401 retry with token refresh

---

## Project Structure

```
outlook-mcp-skills/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   ├── outlook-auth/SKILL.md    # + 18 more skill directories
│   ├── outlook-base/SKILL.md
│   └── ...
├── mcp-server/
│   ├── src/
│   │   ├── index.js             # MCP server entry point
│   │   ├── auth.js              # Token management (port of token_helper.py)
│   │   └── graph.js             # Graph API proxy (port of graph_call.py)
│   ├── package.json
│   ├── package-lock.json
│   └── node_modules/            # Installed dependencies (not in plugin)
├── outlook-skills/
│   ├── tokens.json              # OAuth tokens (NEVER commit this)
│   ├── token_helper.py          # Python token helper (CLI use)
│   └── ...
├── .mcp.json                    # Plugin MCP config (for Claude Code CLI)
├── README.md
└── SETUP.md                     # This file
```

### Key Distinction: `.mcp.json` vs `claude_desktop_config.json`

| File | Used By | Purpose |
|------|---------|---------|
| `.mcp.json` (in project root) | Claude Code CLI | Plugin-bundled MCP config using `${CLAUDE_PLUGIN_ROOT}` |
| `claude_desktop_config.json` | Claude Desktop / Cowork | Host-level MCP server registration with absolute paths |

The `.mcp.json` in the project uses portable `${CLAUDE_PLUGIN_ROOT}` paths and works when the plugin is used with Claude Code directly. For Claude Desktop and Cowork, the MCP server must be registered in `claude_desktop_config.json` because uploaded plugins cannot launch stdio processes from the sandbox.

---

## Troubleshooting

### Skills not appearing after plugin upload

- Ensure the `.plugin` file uses forward-slash path separators (not backslashes)
- Verify `.claude-plugin/plugin.json` is at the root of the zip archive
- Check that the file extension is `.plugin` (not `.zip`)

### MCP tools not appearing

- Verify the `outlook` entry exists in `claude_desktop_config.json`
- Ensure the path to `index.js` is correct and absolute
- Check that `node_modules` is installed in the `mcp-server/` directory
- Restart Claude Desktop fully (not just close the window)

### Authentication failures

- Check that `tokens.json` exists and is readable
- Verify the `OUTLOOK_TOKEN_FILE` environment variable path is correct
- Try `outlook_auth` with action `"reauth"` to force a fresh login
- Ensure the Azure AD app registration is still valid

### Network errors from MCP server

- The MCP server runs on the **host machine**, not in the VM — it should have full network access
- Check that `https://graph.microsoft.com` and `https://login.microsoftonline.com` are reachable from the host
- Corporate firewalls/VPNs may interfere — test with `curl https://graph.microsoft.com/v1.0/me` (with a valid token)

---

## Security Notes

- **`tokens.json` contains sensitive OAuth tokens** — never commit to version control, never include in the plugin `.zip`
- The `.gitignore` should include `tokens.json`, `node_modules/`, and `.env`
- The MCP server restricts API access to `/me` and `/users/` endpoints only
- Access tokens are short-lived (~1 hour) with automatic refresh
- Sessions are capped at 30 days for security
