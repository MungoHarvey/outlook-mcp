# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Phases 1–2 of `.advanced-plans/master-plan-v2.1-review-and-roadmap.md`.

### Fixed
- Pagination: `graph_call.py` and the MCP proxy now accept `@odata.nextLink`
  (absolute Graph v1.0 URLs); previously every second page failed with 400.
- Queries containing spaces or quotes (`$search="two words"`,
  `displayName eq 'My Projects'`) are percent-encoded instead of failing
  with an opaque 500.
- MCP endpoint guard is segment-exact and rejects backslash traversal
  (`/me\..\..\beta\users` previously reached `/beta/users`); both proxies
  reject `\` and `%5c`.
- The access token is no longer forwarded when Graph redirects to another host.
- A revoked session now suggests `--reauth`; an expired client secret is
  reported as a configuration error instead of a "transient network error".
- Docs: plain `DELETE` on a message is not irreversible (it goes to
  Recoverable Items); deleting a meeting as organiser **does** notify
  attendees. Both corrected against Microsoft Graph v1.0 documentation.

### Added
- Message content is sanitised inside the proxy by default
  (`scripts/sanitize.py`, mirrored in `mcp-server/src/sanitize.js`): HTML is
  reduced to visible text (hidden CSS, comments, scripts, invisible Unicode
  removed) and wrapped in untrusted-content markers. `--raw-body` /
  `raw_body` opts out for the user's own drafts.
- Request bodies via stdin (`-`) or file (`@FILE`); skills now use quoted
  heredocs, so apostrophes and email text cannot break or inject into the
  shell command.
- `--out-dir [--out-name]` saves responses (attachments, `.eml`) with
  sanitised, never-overwriting file names; attachment names are looked up
  by the proxy so sender-chosen names never touch the shell. Binary
  responses are never printed; large `contentBytes` are elided.
- `retry_after` on throttled responses; 504 on timeouts.
- `POST …/permanentDelete` (true purge, double-confirmed); event delete with
  SAFETY guidance; forwarding-rule exfiltration warning; SAFETY markers for
  draft delete, contact overwrite, reply-all and forward.
- Tests: HTTP-level proxy tests against a local mock Graph server, shared
  Python/Node fixtures for the sanitiser and endpoint guard, a per-command
  SAFETY-marker check, and anchor-aware link checking.

### Changed
- Large attachments (over ~3 MB) are documented as not yet supported: the
  upload-session PUT goes to a host the proxy deliberately refuses.

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
