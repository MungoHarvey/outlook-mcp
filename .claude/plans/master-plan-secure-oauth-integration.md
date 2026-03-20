# Plan: Integrate Secure OAuth System from `outlook-skills/`

## Context

The existing `.claude/skills/` system has a critical security flaw: **the LLM directly reads plaintext OAuth tokens** from `~/.outlook-mcp-tokens.json` via `TOKEN=$(python3 -c "import json; print(json.load(...)['access_token'])")` and passes them through shell variables to curl commands. The token is visible to the LLM at every API call.

New files in `outlook-skills/` implement a secure alternative:
- **AES-256 Fernet encryption** for tokens at rest (`~/.skills/tokens.enc`)
- **OS keychain** for the encryption key (never on disk)
- **OAuth 2.0 + PKCE** for the auth flow
- **30-day session enforcement** with auto-refresh
- Python abstraction layer (`token_helper.py`) that manages decryption/refresh internally

**Goal**: Integrate the new encrypted auth system so the LLM can make Graph API calls **without ever seeing token values**.

---

## Key Design Decision: `graph_call.py` Proxy

The LLM currently constructs curl commands with `$TOKEN`. We replace this with a **Python proxy script** that:
1. Accepts: HTTP method, endpoint, optional JSON body, optional headers
2. Internally calls `token_helper.get_token()` to decrypt/refresh the token
3. Makes the Graph API request
4. Returns **only the JSON response** to stdout — the token never appears in any output

```
# Old (INSECURE — LLM sees token):
TOKEN=$(python3 -c "...read plaintext token...")
curl -H "Authorization: Bearer $TOKEN" "https://graph.microsoft.com/v1.0/me/messages"

# New (SECURE — LLM never sees token):
python3 scripts/graph_call.py GET "/me/messages?$top=10&$select=id,subject"
```

This preserves the existing skill architecture (SKILL.md files still describe *what* to call) while adding a security boundary.

---

## Decisions

- **Python libs** (`outlook.py`, `calendar_skill.py`): Keep as dev utilities for direct Python testing/scripting. Fix imports but don't reference from skills.
- **Client secret**: Move to OS keychain now (not deferred). `auth_runner.py` will prompt on first run and store via `keyring`. `config.json` keeps only `tenant_id` and `client_id`.
- **Rollout**: Incremental. Existing skills are well-developed — focus is on making them work with the new secure auth, not rewriting their logic.

---

## Implementation Phases

### Phase 1: Create missing files, fix imports, keychain for client_secret

**1a. Create `outlook-skills/requirements.txt`** (referenced by `auth.sh` line 15 but missing)
```
cryptography>=41.0.0
keyring>=24.0.0
```

**1b. Create `outlook-skills/config.example.json`** (referenced by `auth.sh` line 17 but missing) — no longer contains client_secret:
```json
{
  "tenant_id": "common",
  "client_id": "YOUR_CLIENT_ID"
}
```

**1c. Move `client_secret` to OS keychain:**
- Update `auth_runner.py` to store/retrieve `client_secret` via `keyring.set_password("azure-skills-auth", "client-secret", ...)` instead of reading from `config.json`
- On first run (or `--reauth`), if no keychain entry exists, prompt user to enter client_secret interactively (or read from config.json as a one-time migration, then delete from config)
- Update `token_helper.py`'s `_refresh_access_token()` to read client_secret from keychain instead of `config.json`
- Remove `client_secret` field from `config.json` template and docs

**1d. Fix `token_helper.py` error messages** — currently reference `skills/azure-auth/auth.sh`; update to `outlook-skills/auth.sh`

**1e. Fix `outlook.py` and `calendar_skill.py` imports** — currently `from _shared.token_helper import ...` which assumes a `_shared/` sibling directory. Update to direct import since `token_helper.py` is in the same directory.

**1f. Add missing scopes to `auth_runner.py`**:
- Add `"contacts_read": "Contacts.Read"` to `SCOPE_CATALOGUE`
- Add `"mail_write"` and `"contacts_read"` to `DEFAULT_PERMISSIONS` (needed for move, delete, organize, contacts skills)

**1g. Fix `auth.sh` httpx reference** — line 81 checks `import keyring, cryptography, httpx` but httpx isn't used anywhere. Remove from the check.

---

### Phase 2: Build `scripts/graph_call.py` — the security boundary

This is the **most critical new file**. Create `scripts/graph_call.py`:

**Interface:**
```bash
python3 scripts/graph_call.py METHOD "/endpoint" ['{"json":"body"}'] [--header "Key: Value"]
```

**Behaviour:**
- Bootstraps venv site-packages from `outlook-skills/.venv/` (handles Windows/Linux paths)
- Imports `token_helper.get_token()` from `outlook-skills/`
- Makes the Graph API request via `urllib`
- On 401: auto-refreshes token and retries once
- Outputs **only** `{"status": CODE, "data": {...}}` or `{"status": CODE, "error": "...", "message": "..."}`
- **Never** prints, logs, or includes token values in any output
- Supports `--header` for custom headers (e.g., `Prefer: outlook.timezone=...` for calendar)

**Security hardening in this file:**
- Wrap all code in try/except; error messages never contain token values
- Suppress Python tracebacks that might leak token variables
- No debug/verbose mode that could print tokens

---

### Phase 3: Update `outlook-auth/` skill for new auth flow

**`outlook-auth/SKILL.md`** — rewrite to use `bash outlook-skills/auth.sh`:
- Check status: `bash outlook-skills/auth.sh --status`
- Authenticate: `bash outlook-skills/auth.sh`
- Force re-login: `bash outlook-skills/auth.sh --reauth`
- Revoke: `bash outlook-skills/auth.sh --revoke`
- Verify API access: `python3 scripts/graph_call.py GET "/me"`
- Remove all references to `~/.outlook-mcp-tokens.json`, `node scripts/outlook-auth-server.js`, `TOKEN=$(...)`

**`outlook-auth/reference.md`** — update:
- Redirect URI → `http://localhost:8400/callback` (was 3333)
- Config → `~/.skills/config.json` (was `.env`)
- Remove token file structure section (encrypted, LLM shouldn't know format)
- Add Azure app permissions needed (same list, but reference new setup flow)

---

### Phase 4: Update `outlook-base/` foundation skill

**`outlook-base/SKILL.md`** — replace token management and curl sections:
- Remove `TOKEN=$(python3 -c ...)` block entirely
- Replace curl patterns with `python3 scripts/graph_call.py` patterns
- Add explicit safety rule: "**Never** attempt to read tokens directly, import `token_helper`, or call `get_token()`. Always use `scripts/graph_call.py`."

**`outlook-base/reference.md`** — rewrite curl templates:
- Replace all 4 curl templates (GET/POST/PATCH/DELETE) with `graph_call.py` equivalents
- Replace auto-retry-on-401 pattern (proxy handles it internally)
- Keep: OData query parameters, pagination guidance, throttling limits, response parsing
- Update response parsing: output is now `{"status": N, "data": {...}}` — parse the `data` field

---

### Phase 5: Update all 16 operation skill SKILL.md files

Mechanical replacement in each file:
1. Remove the `TOKEN=$(python3 -c ...)` block
2. Replace `curl -s -H "Authorization: Bearer $TOKEN"` commands with `python3 scripts/graph_call.py` commands
3. Keep everything else (confirmation flows, response parsing, parameter docs)

Files to update:
- `outlook-email-list/SKILL.md` — GET → `graph_call.py GET`
- `outlook-email-read/SKILL.md` — GET → `graph_call.py GET`
- `outlook-email-send/SKILL.md` — POST → `graph_call.py POST` (keep SAFETY confirmation)
- `outlook-email-reply/SKILL.md` — POST → `graph_call.py POST`
- `outlook-email-move/SKILL.md` — POST → `graph_call.py POST`
- `outlook-email-delete/SKILL.md` — DELETE → `graph_call.py DELETE`
- `outlook-email-organize/SKILL.md` — PATCH → `graph_call.py PATCH`
- `outlook-calendar-list/SKILL.md` — GET → `graph_call.py GET --header "Prefer: ..."`
- `outlook-calendar-create/SKILL.md` — POST → `graph_call.py POST`
- `outlook-calendar-update/SKILL.md` — PATCH → `graph_call.py PATCH`
- `outlook-calendar-respond/SKILL.md` — POST → `graph_call.py POST`
- `outlook-contacts-list/SKILL.md` — GET → `graph_call.py GET`
- `outlook-contacts-manage/SKILL.md` — POST/PATCH → `graph_call.py POST/PATCH`
- `outlook-folders/SKILL.md` — GET/POST → `graph_call.py GET/POST`
- `outlook-rules/SKILL.md` — GET/POST/PATCH → `graph_call.py`
- `outlook-categories/SKILL.md` — GET → `graph_call.py GET`

Also update any `reference.md` files that contain `$TOKEN` or curl-with-Bearer patterns.

---

### Phase 6: Add security tests

**Create `test/static/security.test.js`** — validates no skill leaks tokens:
- No SKILL.md contains `get_token` (LLM should never call this)
- No SKILL.md contains `token_helper` import
- No SKILL.md contains `~/.outlook-mcp-tokens.json` (old plaintext path)
- No SKILL.md contains `$TOKEN` or `access_token` (old shell variable pattern)
- `scripts/graph_call.py` source code never prints token values

**Update `test/eval/curl-structure.test.js`** → rename to `api-call-structure.test.js`:
- Update to validate `graph_call.py` invocation patterns instead of curl patterns
- Verify correct HTTP methods and endpoint patterns per skill

**Update `test/unit/`** — add Python test for `token_helper.py` and `graph_call.py` (or keep Node.js tests that verify script structure)

---

### Phase 7: Update project files

**`CLAUDE.md`** — update:
- Replace token management pattern with `graph_call.py` proxy description
- Replace "Token is read with python3" convention with "Tokens are encrypted at rest; API calls go through `scripts/graph_call.py` which handles auth internally"
- Update auth section to reference `outlook-skills/auth.sh`
- Add security architecture section
- Remove `~/.outlook-mcp-tokens.json` references
- Update env vars section (`.env` → `~/.skills/config.json`)

**`package.json`** — update scripts section

**`.gitignore`** — add: `outlook-skills/.venv/`, `*.enc`

**Deprecate (do not delete yet):** `scripts/outlook-auth-server.js`, `scripts/outlook-token-refresh.js` — add deprecated comment at top

---

## Security Audit Findings

### New code strengths
| Aspect | Implementation | Status |
|---|---|---|
| Token encryption at rest | AES-256 Fernet | Good |
| Encryption key storage | OS keychain (never on disk) | Good |
| OAuth flow security | PKCE (S256) + CSRF state validation | Good |
| Session enforcement | 30-day hard limit, non-renewable | Good |
| File permissions | `chmod 700` (dir), `chmod 600` (file) | Good (POSIX only) |
| Token refresh | Silent auto-refresh with rotation support | Good |

### Issues to address during implementation
1. **`client_secret` in plaintext** — moving to OS keychain in Phase 1 (user decision)
2. **Windows `chmod` is no-op** — on Windows, the encrypted file + keychain is the security boundary (acceptable since keychain via Windows Credential Manager is the primary protection)
3. **`auth.sh` references `httpx`** (line 81) but nothing uses httpx — remove from the check
4. **`outlook.py`/`calendar_skill.py` import path** assumes `_shared/` directory structure that doesn't exist — fix to same-directory import
5. **LLM bypass risk** — the LLM could theoretically run `python3 -c "from token_helper import get_token; print(get_token())"`. Mitigations: skill instructions explicitly forbid it; security tests verify no SKILL.md contains such patterns; `graph_call.py` is the only sanctioned interface

---

## Critical Files

| File | Action | Purpose |
|---|---|---|
| `scripts/graph_call.py` | **CREATE** | Security boundary proxy — most important new file |
| `outlook-skills/requirements.txt` | **CREATE** | Missing dependency file |
| `outlook-skills/config.example.json` | **CREATE** | Missing config template |
| `outlook-skills/token_helper.py` | **EDIT** | Fix error message paths |
| `outlook-skills/auth_runner.py` | **EDIT** | Add missing scopes, fix httpx reference |
| `outlook-skills/outlook.py` | **EDIT** | Fix import path |
| `outlook-skills/calendar_skill.py` | **EDIT** | Fix import path |
| `.claude/skills/outlook-base/SKILL.md` | **REWRITE** | Foundation — all skills reference this |
| `.claude/skills/outlook-base/reference.md` | **REWRITE** | Curl templates → graph_call.py |
| `.claude/skills/outlook-auth/SKILL.md` | **REWRITE** | New auth flow |
| `.claude/skills/outlook-auth/reference.md` | **REWRITE** | New setup instructions |
| `.claude/skills/outlook-email-*/SKILL.md` | **EDIT** (x7) | Replace TOKEN/curl with graph_call.py |
| `.claude/skills/outlook-calendar-*/SKILL.md` | **EDIT** (x4) | Replace TOKEN/curl with graph_call.py |
| `.claude/skills/outlook-contacts-*/SKILL.md` | **EDIT** (x2) | Replace TOKEN/curl with graph_call.py |
| `.claude/skills/outlook-folders/SKILL.md` | **EDIT** | Replace TOKEN/curl |
| `.claude/skills/outlook-rules/SKILL.md` | **EDIT** | Replace TOKEN/curl |
| `.claude/skills/outlook-categories/SKILL.md` | **EDIT** | Replace TOKEN/curl |
| `test/static/security.test.js` | **CREATE** | Token leak prevention tests |
| `test/eval/curl-structure.test.js` | **REWRITE** | Validate graph_call.py patterns |
| `CLAUDE.md` | **EDIT** | Update conventions |
| `.gitignore` | **EDIT** | Add venv, .enc |

---

## Verification

1. **Run existing tests** first to establish baseline: `npm test`
2. **Create missing files** (Phase 1) and verify `bash outlook-skills/auth.sh --status` works
3. **Build and test `graph_call.py`** against live API (requires auth): `python3 scripts/graph_call.py GET "/me"`
4. **Run security tests**: `npm run test:static` — verify no SKILL.md contains token patterns
5. **Run full test suite**: `npm test` — all static, unit, eval tests should pass
6. **Manual smoke test**: trigger a skill (e.g., "check my inbox") and verify it uses `graph_call.py` and returns results without token exposure
7. **Integration test**: `OUTLOOK_INTEGRATION_TEST=true npm run test:integration`
