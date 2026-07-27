# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-07-27

First fully downloadable release: installable as a Claude Code plugin straight
from GitHub via the built-in marketplace flow.

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
- `mcp-server/package-lock.json` — pinned dependencies (0 audit findings) so
  the optional MCP server installs reproducibly for Claude Desktop/Cowork.

### Changed
- All 20 skills call the Microsoft Graph API exclusively through the
  `scripts/graph_call.py` proxy; no skill instructs the model to handle a
  Bearer token (18 legacy `curl` templates converted).
- Token stores are written atomically and owner-only (0600 / icacls) at
  creation, not just on refresh.
- Version aligned to 2.0.0 across `plugin.json`, `package.json`, and
  `mcp-server/package.json`; Node engine requirement raised to >= 18.
- Auth error messages now print absolute paths to `auth.sh`/`auth.ps1` so they
  work from any install location.

### Removed
- Root `.mcp.json`: the MCP server is not part of the plugin surface (it
  cannot start from a fresh plugin cache without `npm install`). Claude
  Desktop/Cowork users configure `mcp-server/` explicitly — see SETUP.md.

### Fixed
- Installer re-runs no longer nest a duplicate skill folder inside the
  existing one (`setup/install.sh` / `setup/install.ps1`).
- `.gitignore` now covers credential backup/temp variants (`.env.*`,
  `tokens.json*`) at any path while keeping `.env.example` and lockfiles
  tracked; local Claude settings and session artifacts untracked.
- Windows icacls hardening uses argument arrays (no shell string
  interpolation).

## [1.0.0]

Initial skills architecture: 20 progressive-loading skills, secure
`graph_call.py` token proxy, Node.js OAuth server, static/unit/eval/integration
test suites.
