# Development Notes — Outlook MCP Skills Plugin

This document captures the lessons learned, architectural decisions, and platform constraints discovered while building the Outlook integration for Claude Desktop and Cowork. It serves as a reference for future development and for anyone extending this plugin.

---

## Architecture Decision Record

### The Two-Layer Architecture

**Decision**: Split the plugin into a skills-only `.plugin` file (drag-and-drop) + a stdio MCP server registered in `claude_desktop_config.json`.

**Context**: We initially attempted to bundle everything — skills, MCP server, and `node_modules` — into a single `.plugin` file. This failed for multiple reasons (detailed below). After extensive investigation, we determined that all existing local MCP servers (filesystem, obsidian, GitLab) use `claude_desktop_config.json`, not plugin bundles.

**Rationale**:
- Cowork's uploaded/remote plugins support HTTP MCP servers from `.mcp.json`, but they do **not** launch stdio MCP server processes
- The Cowork VM is network-sandboxed — it cannot make outbound HTTPS requests to `graph.microsoft.com`
- Local MCP servers declared in `claude_desktop_config.json` run on the **host machine** (Windows/macOS), outside the sandbox
- Skills are pure knowledge (markdown) and work perfectly as an uploaded plugin
- This mirrors the established pattern for every other local integration

**Alternatives considered**:
1. *Full plugin bundle* — Failed due to zip path character restrictions (`@` in npm scoped packages) and backslash issues
2. *HTTP MCP server in plugin `.mcp.json`* — Would work for remote servers but not for localhost stdio
3. *Shell-based `graph_call.py` from VM* — Blocked by the network sandbox (no outbound HTTPS)

### Two-Tool MCP Design

**Decision**: The MCP server exposes exactly two tools: `outlook_auth` and `outlook_api`.

**Rationale**: Keeping the MCP surface minimal (~200 tokens of schema) means Claude's context isn't consumed by tool definitions. The intelligence lives in the 19 skill files, which Claude reads on demand. Each skill tells Claude *what* Graph API call to make; the `outlook_api` tool is just the execution mechanism.

**Alternative considered**: One MCP tool per skill operation (19+ tools). Rejected because it would consume ~2000+ context tokens on every interaction and duplicate logic that already exists in the skill markdown files.

### Shared Token File

**Decision**: Both the Python CLI tools (`graph_call.py`, `token_helper.py`) and the Node.js MCP server read/write the same `outlook-skills/tokens.json`.

**Rationale**: A user who authenticates via Claude Code (`auth.sh`) shouldn't need to re-authenticate when switching to Cowork, and vice versa. The token format is simple JSON with known fields — both runtimes can handle it.

---

## Platform Constraints Discovered

### Cowork VM Sandbox

The Cowork environment runs a lightweight Linux VM on the user's machine. Key constraints:

- **No arbitrary outbound HTTPS**: The VM has an HTTP proxy on port 3128, but it blocks CONNECT tunnels to external domains. Only Anthropic-proxied tools and localhost MCP servers can connect externally.
- **MCP servers run on the host**: Stdio MCP servers declared in `claude_desktop_config.json` are launched by Claude Desktop on the host OS, not inside the VM. This is how they bypass the network sandbox.
- **File access via MCP**: The VM can read/write to the user's filesystem through the `filesystem` MCP server, but cannot directly access Windows paths.

### Plugin Upload Validator

The Cowork plugin upload system has strict requirements:

- **Forward-slash paths only**: Zip archives must use POSIX path separators (`skills/outlook-auth/SKILL.md`). Windows backslashes (`skills\outlook-auth\SKILL.md`) cause silent upload failure.
- **No `@` in paths**: npm scoped packages (`@modelcontextprotocol/sdk/`) contain `@` characters which the validator rejects as "invalid characters".
- **`.plugin` extension**: The file must end in `.plugin`, not `.zip`. PowerShell's `Compress-Archive` refuses to create non-`.zip` archives — workaround is to create as `.zip` then rename.

### PowerShell JSON Handling

**Critical warning**: PowerShell's `ConvertFrom-Json | ConvertTo-Json` pipeline is **not safe** for editing `claude_desktop_config.json`.

- It silently flattens nested objects
- It can remove existing MCP server entries
- It produces output that Claude Desktop cannot parse

**Always edit `claude_desktop_config.json` manually** on Windows (Notepad, VS Code, etc.). On macOS/Linux, `jq` is safe for programmatic edits.

### PowerShell Zip Creation

`Compress-Archive` creates zip files with Windows backslash path separators internally. These are technically non-standard (the ZIP specification requires forward slashes) and are rejected by the Cowork upload validator.

**Safe alternatives**:
- Linux/macOS `zip` command (always uses forward slashes)
- Python `zipfile` module with explicit `path.replace("\\", "/")`
- Building from within a Cowork session (Linux VM)

### `${CLAUDE_PLUGIN_ROOT}` Variable

This portable path variable works in `.mcp.json` files for Claude Code CLI plugins, resolving to the plugin's install directory at runtime. However, it does **not** work for Cowork uploaded plugins — those need absolute paths in `claude_desktop_config.json`.

---

## Project History

### Phase 1: Claude Code Plugin (branch `outlook-skills`)

The original project was built for Claude Code (terminal). Skills reference `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py` for all API calls. Authentication uses a Node.js OAuth server (`auth-server.js`) and Python token management (`token_helper.py`).

This works well in Claude Code where Python and shell access are available.

### Phase 2: Desktop/Cowork Port (branch `plugin-dev`)

Goal: Make the same skills work in Claude Desktop and Cowork, where the network sandbox prevents direct Graph API calls from the VM.

**Steps taken**:
1. Designed the two-tool MCP architecture (`DESIGN-SPEC.md`)
2. Ported `token_helper.py` to Node.js (`mcp-server/src/auth.js`)
3. Ported `graph_call.py` to Node.js (`mcp-server/src/graph.js`)
4. Built the MCP server entry point (`mcp-server/src/index.js`)
5. Installed dependencies and smoke-tested on Windows host
6. Attempted to bundle everything in a single `.plugin` — failed (backslashes, `@` paths)
7. Split into skills-only plugin + `claude_desktop_config.json` MCP registration
8. Successfully uploaded skills plugin and registered MCP server
9. Verified end-to-end: `outlook_auth status` + `outlook_api GET /me` both working

**Key failures along the way**:
- PowerShell `Compress-Archive` backslash paths → upload rejected
- Full plugin with `node_modules` → `@` character rejection
- PowerShell JSON round-trip for config edit → destroyed existing MCP entries
- Each failure taught us something about the platform constraints (documented above)

---

## File Inventory — What Belongs Where

### Core (must ship)

| Path | Purpose | Ships in plugin? | Ships in config? |
|------|---------|:-:|:-:|
| `.claude-plugin/plugin.json` | Plugin manifest | Yes | — |
| `skills/outlook-*/SKILL.md` | 19 skill definitions | Yes | — |
| `skills/outlook-*/reference.md` | Extended patterns | Yes | — |
| `skills/outlook-*/params.yaml` | Parameter options | Yes | — |
| `skills/outlook-*/references/*.yaml` | Shared reference data | Yes | — |
| `mcp-server/src/index.js` | MCP server entry | — | Yes (path in config) |
| `mcp-server/src/auth.js` | Token management | — | Yes |
| `mcp-server/src/graph.js` | Graph API proxy | — | Yes |
| `mcp-server/package.json` | Server dependencies | — | Yes |
| `.mcp.json` | Claude Code MCP config | Yes | — |

### Auth system (required on host, not in plugin)

| Path | Purpose |
|------|---------|
| `outlook-skills/auth-server.js` | OAuth callback server (Claude Code) |
| `outlook-skills/auth.sh` / `auth.ps1` | Auth entry points (Claude Code) |
| `outlook-skills/token_helper.py` | Python token helper (Claude Code) |
| `outlook-skills/.env` | Azure credentials (NEVER commit) |
| `outlook-skills/tokens.json` | OAuth tokens (NEVER commit) |

### Documentation

| Path | Purpose |
|------|---------|
| `README.md` | Project overview |
| `SETUP.md` | Cowork/Desktop setup guide |
| `DEVELOPMENT.md` | This file — lessons learned |
| `DESIGN-SPEC.md` | Original architecture spec |
| `CLAUDE.md` | Claude Code project context |

### Development & Testing

| Path | Purpose |
|------|---------|
| `test/static/` | Skill file structure validation |
| `test/unit/` | Auth script unit tests |
| `test/eval/` | Skill selection assertions |
| `test/integration/` | Live Graph API smoke tests |
| `package.json` | Root-level dev dependencies & test scripts |
| `.github/workflows/` | CI configuration |

### Research (historical, gitignored)

| Path | Purpose |
|------|---------|
| `research/` | API endpoint research, roadmap (gitignored) |

### Candidates for Removal

| Path | Reason |
|------|--------|
| `New folder/` | Empty directory — development debris |
| `outlook-skills/outlook-skills-zip/` | Old packaging attempt — duplicate of `skills/` |
| `build-plugin.ps1` | Superseded — creates broken backslash zips |
| `build-plugin-minimal.ps1` | Superseded — same backslash problem |
| `add-outlook-mcp.ps1` | Deprecated — PowerShell JSON round-trip is unsafe |
| `loop-complete.json` | Claude Code session artefact |
| `.claude/loop-complete.json` | Claude Code session artefact |
| `.claude/state/` | Claude Code session state |
| `.cursor/` | Cursor editor state |
| `outlook-skills.plugin` | Build artefact (should be rebuilt, not committed) |
| Root `node_modules/` | Should be in `.gitignore` (already is) |
| Root `package-lock.json` | Regenerated by `npm install` |

---

## MCP Server Technical Reference

### Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol implementation (stdio transport, tool registration)
- `zod` — Input schema validation

### Token Flow

```
outlook_api called
  → auth.js: loadTokens() from tokens.json
  → Check session age (< 30 days?)
  → Check access_token expiry
  → If expired: POST to Azure token endpoint with refresh_token
  → If refresh succeeds: save new tokens, return access_token
  → If refresh fails or session expired: return AuthRequiredError
  → graph.js: build request with Bearer token
  → fetch() to graph.microsoft.com
  → If 401: retry once after token refresh
  → Return {status, data} to Claude
```

### Environment Variable

The MCP server uses one environment variable set in `claude_desktop_config.json`:

- `OUTLOOK_TOKEN_FILE` — absolute path to `tokens.json`

If unset, it falls back to a relative path from the server's own directory.

### Azure AD Configuration

| Parameter | Value |
|-----------|-------|
| Client ID | (from your Azure App Registration — see `outlook-skills/.env`) |
| Tenant ID | (from your Azure App Registration — see `outlook-skills/.env`) |
| Auth endpoint | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` |
| Token endpoint | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| Scopes | Mail.Read, Mail.ReadWrite, Mail.Send, Calendars.Read, Calendars.ReadWrite, Contacts.Read, User.Read |

---

## Future Considerations

1. **Skill updates**: Skills on `main` should be the canonical source. When skills change, rebuild and re-upload the `.plugin` file. The MCP server doesn't need updating for skill changes.

2. **MCP server updates**: If `auth.js` or `graph.js` change, only the host files need updating — restart Claude Desktop to pick up changes. No plugin re-upload needed.

3. **Cross-platform testing**: The MCP server has been tested on Windows. macOS and Linux testing is pending but should work identically (Node.js is cross-platform).

4. **Plugin marketplace**: When Anthropic opens a plugin marketplace, consider publishing the skills-only plugin there. The MCP server would still need local installation via `claude_desktop_config.json`.

5. **`graph_call.py` deprecation**: Once the MCP server is proven stable, the Python auth system (`token_helper.py`, `auth-server.js`, `graph_call.py`) could be deprecated in favour of the Node.js MCP server for all platforms. This would simplify the project to a single runtime (Node.js).
