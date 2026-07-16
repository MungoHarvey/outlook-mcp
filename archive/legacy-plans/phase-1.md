# Phase 1: Foundation Fixes & Keychain Security

## Objective

Fix missing files, broken imports, and incomplete scopes in `outlook-skills/`, and move `client_secret` into the OS keychain to establish a fully functional and secure auth foundation for all subsequent phases.

## Scope

### Included:
- Create missing `requirements.txt` and `config.example.json` referenced by `auth.sh`
- Move `client_secret` storage from plaintext `config.json` to OS keychain via `keyring`
- Update `token_helper.py` to read `client_secret` from keychain instead of config file
- Fix broken import paths in `outlook.py` and `calendar_skill.py` (`_shared.token_helper` -> direct import)
- Add missing Graph API scopes (`Contacts.Read`, `Mail.ReadWrite` in defaults)
- Remove phantom `httpx` dependency check from `auth.sh`
- Fix all stale path references (`skills/azure-auth/auth.sh` -> `outlook-skills/auth.sh`)

### Explicitly NOT included:
- Building `graph_call.py` proxy (Phase 2)
- Updating any `.claude/skills/` SKILL.md files (Phases 3-5)
- Security tests (Phase 6)
- CLAUDE.md or project file updates (Phase 7)

## Key Deliverables

| Deliverable | Format | Location |
|-------------|--------|----------|
| Python dependency manifest | `requirements.txt` | `outlook-skills/requirements.txt` |
| Config template (no secrets) | JSON | `outlook-skills/config.example.json` |
| Keychain-backed auth runner | Python | `outlook-skills/auth_runner.py` (edited) |
| Keychain-backed token helper | Python | `outlook-skills/token_helper.py` (edited) |
| Fixed dev utility — email | Python | `outlook-skills/outlook.py` (edited) |
| Fixed dev utility — calendar | Python | `outlook-skills/calendar_skill.py` (edited) |
| Fixed bootstrap script | Bash | `outlook-skills/auth.sh` (edited) |

## Success Criteria

- ✓ `outlook-skills/requirements.txt` exists and contains `cryptography>=41.0.0` and `keyring>=24.0.0`
- ✓ `outlook-skills/config.example.json` exists with only `tenant_id` and `client_id` fields (no `client_secret`)
- ✓ `auth_runner.py` stores `client_secret` in keychain on first auth; reads it from keychain on subsequent runs
- ✓ `token_helper.py` `_refresh_access_token()` reads `client_secret` from keychain, not from `config.json`
- ✓ `auth.sh` dependency check no longer references `httpx`
- ✓ `auth_runner.py` `SCOPE_CATALOGUE` includes `"contacts_read": "Contacts.Read"` and `DEFAULT_PERMISSIONS` includes `"mail_write"` and `"contacts_read"`
- ✓ `outlook.py` and `calendar_skill.py` import `token_helper` from the same directory (not `_shared.token_helper`)
- ✓ All error messages in `token_helper.py` reference `outlook-skills/auth.sh` (not `skills/azure-auth/auth.sh`)
- ✓ `bash outlook-skills/auth.sh --status` runs without import errors after venv bootstrap
- ✓ `python -c "from outlook-skills.token_helper import get_token"` does not raise `ImportError` (after venv activated)

## Dependencies

### Must Complete Before This Phase:
- None — this is the first phase

### Blocked By:
- Python 3.8+ must be installed on the system (verified by `auth.sh`)
- OS keychain backend must be available (`keyring` uses Windows Credential Manager on Win11)

### Optional:
- Existing `~/.skills/config.json` with `client_secret` present enables one-time migration (read from file, store in keychain, remove from file)

## Skills Required (Broad Categories)

- `python-development`: Editing Python modules, fixing imports, adding keychain integration
- `bash-scripting`: Fixing the `auth.sh` dependency check
- `security-review`: Verifying client_secret is no longer on disk after migration

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `keyring` backend unavailable on Windows | Low | High | Windows Credential Manager is the default backend; `keyring` supports it out of the box. Test with `keyring.get_password()` during venv bootstrap. |
| User has existing `config.json` with `client_secret` | Medium | Low | Implement one-time migration: if `client_secret` found in config.json, move it to keychain and remove from file. Print clear message. |
| Breaking `outlook.py`/`calendar_skill.py` imports for users who adopted `_shared` layout | Low | Low | These are dev utilities not referenced by skills. Direct import is simpler and matches the flat directory layout. |
| `getpass.getpass()` doesn't work in non-interactive contexts | Medium | Medium | Fallback: check if `client_secret` exists in config.json before prompting. Only prompt if both keychain and config are empty. |

## Assumptions

- `keyring` library works with Windows Credential Manager on Win11: validated by the existing `token_helper.py` which already uses `keyring` for the encryption key
- `auth.sh` correctly bootstraps a venv and installs from `requirements.txt`: validated by reading the script — it already handles venv creation and pip install
- The flat directory layout (`outlook-skills/*.py`) is the intended structure: validated by the files being in the same directory, not in a package hierarchy

## Notes / Design Decisions

- **Interactive vs config-file secret entry**: `auth_runner.py` will use `getpass.getpass()` to prompt for `client_secret` when no keychain entry exists. This avoids the secret ever being on disk. Fallback: if `config.json` still has `client_secret` (pre-migration), read it and migrate silently.
- **Keychain service/user for client_secret**: Use `keyring.set_password("azure-skills-auth", "client-secret", value)` — same service as the encryption key, different user field. This keeps all secrets under one keychain service.
- **Config.json migration**: After moving `client_secret` to keychain, rewrite `config.json` without the field. Don't delete the file — it still holds `tenant_id` and `client_id`.
- **Why fix `outlook.py`/`calendar_skill.py` now**: They'll serve as dev testing utilities for verifying auth works in Phase 2. Fixing imports now means they can be used for manual smoke tests.

## Ralph Loops (3)

| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 100 | Create missing files | Implementation | `requirements.txt`, `config.example.json` |
| 101 | Keychain for client_secret | Implementation | Updated `auth_runner.py`, `token_helper.py` with keychain reads; migration logic |
| 102 | Fix imports, scopes, paths | Implementation | Fixed `outlook.py`, `calendar_skill.py` imports; added scopes; fixed error messages; removed `httpx` check |
