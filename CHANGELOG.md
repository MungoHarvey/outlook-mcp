# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] — 2026-11-09

Auth state lookup is now identical in every component, and easier to diagnose.

### Changed
- New state-directory lookup, shared by `token_helper.py`, `graph_call.py`,
  `auth-server.js` and the MCP server: `OUTLOOK_SKILLS_HOME` (if set and
  non-empty; `~` expanded, made absolute) → `~/.outlook-skills` if it holds a
  `.env` or `tokens.json` file → the plugin's own `outlook-skills/` folder →
  `~/.outlook-skills`, where new state is created. `OUTLOOK_TOKEN_FILE` still
  overrides only the token file; `.env` is read only from the chosen directory.
- The plugin's `outlook-skills/` folder now counts only if it holds
  `tokens.json`. A `.env` alone there no longer wins.
- `auth.sh` / `auth.ps1` are thin launchers around `auth-server.js`.
- Auth error messages list the checked directories and give the command for the
  user's platform (`powershell -NoProfile -File ...auth.ps1` on Windows, `bash`
  elsewhere).
- The MCP server loads `.env` once, from the chosen state directory.
- Docs give PowerShell commands alongside `bash`, and no longer suggest
  registering a new Azure app when a `.env` is missing.
- Version bumped to 2.1.0 across the plugin, marketplace and package manifests
  and the MCP server's reported version (previously `1.0.0`).

### Added
- `--where` (`-Where` for `auth.ps1`) on `token_helper.py`, `auth-server.js`,
  `auth.sh` and `auth.ps1`: prints the chosen directory, token file and checked
  directories (paths only, no secrets).
- README section "Moving existing credentials to `~/.outlook-skills`" with
  PowerShell and POSIX commands. Users whose `.env` sits only in the repo's
  `outlook-skills/` should follow it.
- `test/static/state-dir-docs.test.js`: asserts the docs state the lookup order
  and that version fields agree.

## [2.0.0] — 2026-07-27

First fully downloadable release: installable as a Claude Code plugin straight
from GitHub via the built-in marketplace flow. This release also merges the
full code-review remediation line (auth hardening, scope contract, new Python
and Node test tiers).

### Added
- `.claude-plugin/marketplace.json` — the repo is its own plugin marketplace:
  `/plugin marketplace add MungoHarvey/outlook-mcp`, then
  `/plugin install outlook-skills@outlook-mcp`.
- `LICENSE` (MIT) and this changelog.
- Auth state can now live outside the plugin tree. Resolution order:
  `OUTLOOK_SKILLS_HOME` env var → the in-tree `outlook-skills/` directory when
  it already holds `.env`/`tokens.json` (cloned-repo layout) → `~/.outlook-skills`
  (default for plugin installs; survives plugin cache updates).
  `OUTLOOK_TOKEN_FILE` still overrides the token path specifically.
- Single source of truth for the OAuth scope list (`outlook-skills/scopes.json`)
  and the 30-day session constant.
- New Python test tier (endpoint validation, scope contract, token lifecycle)
  and Node auth-server behavioral tests; CI now runs Python.
- `mcp-server/package-lock.json` — pinned dependencies (0 audit findings) so
  the optional MCP server installs reproducibly for Claude Desktop/Cowork.

### Security
- Client secret is no longer written to `tokens.json`; refresh reads it from
  `.env` via a dependency-free parser.
- Token stores are written atomically with restrictive permissions
  (0600 / icacls) at creation, not only on first refresh.
- OAuth callback validates a single-use `state`, pins the `Host` header to
  loopback, HTML-escapes reflected output, and enforces request/server timeouts.
- Windows icacls hardening uses argument arrays (no shell string
  interpolation).

### Changed
- All 20 skills call the Microsoft Graph API exclusively through the
  `scripts/graph_call.py` proxy; no skill instructs the model to handle a
  Bearer token (all legacy `curl` templates converted). Response-parsing
  templates unwrap the `{status, data}` envelope; OData `$` parameters are
  shell-escaped.
- Deduplicated ~56 KB of reference YAML into `skills/outlook-base/references/`.
- Version aligned to 2.0.0 across `plugin.json`, `package.json`, and
  `mcp-server/package.json`; Node engine requirement raised to >= 18.
- Auth error messages now print absolute paths to `auth.sh`/`auth.ps1` so they
  work from any install location.

### Removed
- Root `.mcp.json`: the MCP server is not part of the plugin surface (it
  cannot start from a fresh plugin cache without `npm install`). Claude
  Desktop/Cowork users configure `mcp-server/` explicitly — see SETUP.md.
- Deprecated Node auth scripts (`scripts/outlook-auth-server.js`,
  `scripts/outlook-token-refresh.js`) — superseded by
  `outlook-skills/auth-server.js` and silent refresh in `token_helper.py`.

### Fixed
- **Scopes stay user-consentable**: the requested set is the proven
  user-consentable scopes (incl. `openid`/`profile`/`email`). `Contacts.ReadWrite`
  and `MailboxSettings.ReadWrite` are NOT requested by default — on managed
  tenants they require admin consent and trigger a "Need admin approval" screen
  at sign-in. They live in `scopes.json` under `admin_consent_scopes`;
  contacts-manage, rules, and categories need an admin to grant them.
- **Windows path mangling**: `graph_call.py` self-heals Git-Bash (MSYS) mangled
  endpoints, so all write operations work on Windows without `MSYS_NO_PATHCONV`.
- **Endpoint validation** tightened to a segment-exact `/me` or `/users/` check
  (was a substring match that allowed `/messages`, `/memberOf`).
- **401 auto-retry** now performs a real forced refresh instead of replaying the
  same rejected token.
- Installer re-runs no longer nest a duplicate skill folder inside the
  existing one (`setup/install.sh` / `setup/install.ps1`).
- `.gitignore` now covers credential backup/temp variants (`.env.*`,
  `tokens.json*`) at any path while keeping `.env.example` and lockfiles
  tracked; local Claude settings and session artifacts untracked.

## [1.0.0]

Initial skills architecture: 20 progressive-loading skills, secure
`graph_call.py` token proxy, Node.js OAuth server, static/unit/eval/integration
test suites.
