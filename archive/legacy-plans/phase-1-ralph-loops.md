---
loop: ralph-loop-100
name: Create Missing Files
task_name: Create Missing Files
max_iterations: 5
on_max_iterations: halt
handoff_summary:
  done: "Created outlook-skills/requirements.txt and config.example.json; requirements.txt has cryptography>=41.0.0 and keyring>=24.0.0; config.example.json has tenant_id and client_id fields, no client_secret field."
  failed: ""
  needed: "Loop 101 should update auth_runner.py and token_helper.py to move client_secret to OS keychain."
todos:
  - id: "100-1"
    content: "Create outlook-skills/requirements.txt with cryptography>=41.0.0 and keyring>=24.0.0"
    skill: "NA"
    agent: "worker"
    outcome: "File outlook-skills/requirements.txt exists with both dependency lines"
    status: "completed"
    priority: 1
  - id: "100-2"
    content: "Create outlook-skills/config.example.json with only tenant_id and client_id fields (no client_secret)"
    skill: "NA"
    agent: "worker"
    outcome: "File outlook-skills/config.example.json exists with tenant_id and client_id keys only"
    status: "completed"
    priority: 2
  - id: "100-3"
    content: "Verify both files exist and have correct content: requirements.txt contains cryptography>=41.0.0 and keyring>=24.0.0; config.example.json contains tenant_id and client_id but NOT client_secret"
    skill: "NA"
    agent: "worker"
    outcome: "Verification grep confirms correct content in both files"
    status: "completed"
    priority: 3
---

## Overview

Loop 100 creates two missing files referenced by `auth.sh` but not yet present in the repository:
- `outlook-skills/requirements.txt` — Python dependency manifest used by venv bootstrap
- `outlook-skills/config.example.json` — Safe config template with no secrets (tenant_id + client_id only)

These files are prerequisites for subsequent loops and for the `auth.sh` bootstrap to function correctly.

## Success Criteria

- `outlook-skills/requirements.txt` exists and contains `cryptography>=41.0.0` and `keyring>=24.0.0`
- `outlook-skills/config.example.json` exists with exactly `tenant_id` and `client_id` fields — no `client_secret`

## Skills Required

- General file creation (no project-specific skill needed)

## Inputs

- Phase 1 plan specifying exact package versions and config field names

## Outputs

- `outlook-skills/requirements.txt`
- `outlook-skills/config.example.json`

## Dependencies

- None — this is the first loop in Phase 1

## Complexity

Low — two new files with simple, well-specified content.

---
---
loop: ralph-loop-101
name: Keychain for client_secret
task_name: Keychain for client_secret
max_iterations: 8
on_max_iterations: halt
handoff_summary:
  done: "Updated auth_runner.py with get_or_retrieve_client_secret() using OS keychain, added contacts_read scope and mail_write/contacts_read to DEFAULT_PERMISSIONS; updated token_helper.py to read client_secret from keychain; fixed all stale auth.sh path references."
  failed: ""
  needed: "Loop 102 should fix outlook.py and calendar_skill.py broken imports and remove httpx check from auth.sh."
todos:
  - id: "101-1"
    content: "Update auth_runner.py: add get_or_retrieve_client_secret() function that calls keyring.get_password('azure-skills-auth', 'client-secret'); if not found, migrates from config.json if present; otherwise prompts via getpass.getpass(); then stores the result with keyring.set_password('azure-skills-auth', 'client-secret', value)"
    skill: "NA"
    agent: "worker"
    outcome: "auth_runner.py contains get_or_retrieve_client_secret() function with keyring get/set, config.json migration, and getpass fallback"
    status: "completed"
    priority: 1
  - id: "101-2"
    content: "Update auth_runner.py: update do_auth() to call get_or_retrieve_client_secret() instead of reading client_secret directly from config"
    skill: "NA"
    agent: "worker"
    outcome: "do_auth() no longer reads client_secret from config dict; it calls get_or_retrieve_client_secret()"
    status: "completed"
    priority: 2
  - id: "101-3"
    content: "Update auth_runner.py: add contacts_read to SCOPE_CATALOGUE (value: 'Contacts.Read') and add mail_write and contacts_read to DEFAULT_PERMISSIONS"
    skill: "NA"
    agent: "worker"
    outcome: "SCOPE_CATALOGUE has contacts_read entry; DEFAULT_PERMISSIONS includes mail_write and contacts_read"
    status: "completed"
    priority: 3
  - id: "101-4"
    content: "Update token_helper.py: update _refresh_access_token() to read client_secret from keyring.get_password('azure-skills-auth', 'client-secret') instead of reading from config.json"
    skill: "NA"
    agent: "worker"
    outcome: "_refresh_access_token() uses keyring.get_password for client_secret, not config file read"
    status: "completed"
    priority: 4
  - id: "101-5"
    content: "Update token_helper.py: fix all error messages that reference 'skills/azure-auth/auth.sh' to reference 'outlook-skills/auth.sh' instead"
    skill: "NA"
    agent: "worker"
    outcome: "No occurrences of 'skills/azure-auth/auth.sh' remain in token_helper.py"
    status: "completed"
    priority: 5
  - id: "101-6"
    content: "Verify keychain integration: grep token_helper.py confirms keyring.get_password is called for client_secret and config.json is not read in _refresh_access_token(); grep auth_runner.py confirms get_or_retrieve_client_secret is defined and called from do_auth()"
    skill: "NA"
    agent: "worker"
    outcome: "Grep results confirm all keychain integration is in place and stale config.json reads are removed"
    status: "completed"
    priority: 6
---

## Overview

Loop 101 migrates `client_secret` storage from plaintext `config.json` to the OS keychain using `keyring`. This is the core security improvement of Phase 1. It touches `auth_runner.py` (new helper function, updated `do_auth()`, new scopes) and `token_helper.py` (keychain read in `_refresh_access_token()`, stale path fixes).

The keychain flow:
1. Check `keyring.get_password("azure-skills-auth", "client-secret")`
2. If not found, check legacy `config.json` and migrate if present
3. If still not found, prompt via `getpass.getpass()`
4. Store the result with `keyring.set_password()`

## Success Criteria

- `auth_runner.py` `get_or_retrieve_client_secret()` function exists with keyring get/set + migration + getpass fallback
- `do_auth()` calls `get_or_retrieve_client_secret()` instead of reading from config
- `SCOPE_CATALOGUE` includes `contacts_read: Contacts.Read`
- `DEFAULT_PERMISSIONS` includes `mail_write` and `contacts_read`
- `token_helper.py` `_refresh_access_token()` uses `keyring.get_password` for `client_secret`
- All error messages in `token_helper.py` reference `outlook-skills/auth.sh`

## Skills Required

- General Python editing (no project-specific skill applies)

## Inputs

- Existing `outlook-skills/auth_runner.py`
- Existing `outlook-skills/token_helper.py`
- Phase 1 plan keychain service name: `"azure-skills-auth"`, user field: `"client-secret"`

## Outputs

- Updated `outlook-skills/auth_runner.py`
- Updated `outlook-skills/token_helper.py`

## Dependencies

- Loop 100 must complete (requirements.txt must exist so keyring is installable)

## Complexity

Medium — requires careful Python edits to two files with interrelated logic; migration path adds conditional branching.

---
---
loop: ralph-loop-102
name: Fix imports, scopes, paths
task_name: Fix imports scopes paths
max_iterations: 6
on_max_iterations: halt
handoff_summary:
  done: "Fixed outlook.py and calendar_skill.py: removed parent.parent→parent in sys.path and _shared.token_helper→token_helper in all imports. Fixed auth.sh: removed httpx from dependency check."
  failed: ""
  needed: "Phase 1 complete. Phase 2 can now begin: build scripts/graph_call.py security proxy."
todos:
  - id: "102-1"
    content: "Fix outlook.py import: change sys.path.insert(0, str(Path(__file__).parent.parent)) to sys.path.insert(0, str(Path(__file__).parent)) and change 'from _shared.token_helper import' to 'from token_helper import'"
    skill: "NA"
    agent: "worker"
    outcome: "outlook.py uses parent dir (not parent.parent) in sys.path and imports token_helper without _shared prefix"
    status: "completed"
    priority: 1
  - id: "102-2"
    content: "Fix calendar_skill.py import: apply the same fix as outlook.py — change sys.path.insert to use Path(__file__).parent and change 'from _shared.token_helper import' to 'from token_helper import'"
    skill: "NA"
    agent: "worker"
    outcome: "calendar_skill.py uses parent dir in sys.path and imports token_helper without _shared prefix"
    status: "completed"
    priority: 2
  - id: "102-3"
    content: "Fix auth.sh line that checks for httpx: change 'import keyring, cryptography, httpx' to 'import keyring, cryptography' (remove the httpx import check since httpx is not a project dependency)"
    skill: "NA"
    agent: "worker"
    outcome: "auth.sh dependency check no longer references httpx"
    status: "completed"
    priority: 3
  - id: "102-4"
    content: "Verify all fixes: grep outlook.py and calendar_skill.py confirms no '_shared' references remain; grep auth.sh confirms 'httpx' no longer appears in the dependency check line"
    skill: "NA"
    agent: "worker"
    outcome: "Grep confirms zero _shared references in outlook.py and calendar_skill.py; zero httpx references in auth.sh dependency check"
    status: "completed"
    priority: 4
---

## Overview

Loop 102 cleans up three categories of stale references that would cause runtime failures:

1. **Import paths** in `outlook.py` and `calendar_skill.py` — both use `_shared.token_helper` which doesn't exist in the flat directory layout; the fix is a direct `from token_helper import` after correcting the `sys.path` insertion to use `parent` instead of `parent.parent`.

2. **Phantom httpx dependency** in `auth.sh` — the bootstrap script checks for `httpx` at startup, but `httpx` is not used anywhere in the project; removing it prevents false negatives on clean installs.

3. **Stale path strings** — covered by Loop 101; this loop focuses on the import/httpx issues.

## Success Criteria

- `outlook.py` imports `token_helper` from same directory (no `_shared` prefix)
- `calendar_skill.py` imports `token_helper` from same directory (no `_shared` prefix)
- `auth.sh` dependency check does not include `httpx`
- Zero `_shared` references in `outlook.py` and `calendar_skill.py`

## Skills Required

- General Python and Bash editing (no project-specific skill applies)

## Inputs

- Existing `outlook-skills/outlook.py`
- Existing `outlook-skills/calendar_skill.py`
- Existing `outlook-skills/auth.sh`

## Outputs

- Updated `outlook-skills/outlook.py`
- Updated `outlook-skills/calendar_skill.py`
- Updated `outlook-skills/auth.sh`

## Dependencies

- Loop 100 must complete (requirements.txt exists)
- Loop 101 may run in parallel (these files do not overlap with auth_runner.py / token_helper.py)

## Complexity

Low — targeted single-line or small block changes in three files; verification is straightforward grep.
