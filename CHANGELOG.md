# Changelog

All notable changes to this project are documented here. The format is loosely
based on [Keep a Changelog](https://keepachangelog.com/), and this project uses
a single version across `.claude-plugin/plugin.json` and `package.json`.

## [Unreleased] — Code-review remediation

Fixes from a full code review (functional, security, tests, docs). Highlights:

### Fixed
- **Scopes stay user-consentable**: the requested set is the proven
  user-consentable scopes (incl. `openid`/`profile`/`email`). `Contacts.ReadWrite`
  and `MailboxSettings.ReadWrite` are NOT requested by default -- on managed
  tenants they require admin consent and trigger a "Need admin approval" screen
  at sign-in. They live in `scopes.json` under `admin_consent_scopes`;
  contacts-manage, rules, and categories need an admin to grant them.
- **Windows path mangling**: `graph_call.py` self-heals Git-Bash (MSYS) mangled
  endpoints, so all write operations work on Windows without `MSYS_NO_PATHCONV`.
- **Endpoint validation** tightened to a segment-exact `/me` or `/users/` check
  (was a substring match that allowed `/messages`, `/memberOf`).
- **401 auto-retry** now performs a real forced refresh instead of replaying the
  same rejected token.

### Security
- Client secret is no longer written to `tokens.json`; refresh reads it from
  `.env` via a dependency-free parser.
- Token files are created with restrictive permissions (0600 / icacls) at
  creation, not only on first refresh.
- OAuth callback validates a single-use `state`, pins the `Host` header to
  loopback, HTML-escapes reflected output, and enforces request/server timeouts.

### Changed
- Skill examples use the `graph_call.py` proxy exclusively (no raw curl/Bearer);
  response-parsing templates unwrap the `{status, data}` envelope; OData `$`
  parameters are shell-escaped.
- Single source of truth for the OAuth scope list (`outlook-skills/scopes.json`)
  and the 30-day session constant.
- Deduplicated ~56 KB of reference YAML into `skills/outlook-base/references/`.

### Tests / tooling
- New Python test tier (endpoint validation, scope contract, token lifecycle)
  and Node auth-server behavioral tests; CI now runs Python.
- Bumped `engines.node` to `>=18`; synced plugin/package version to `2.0.0`.
