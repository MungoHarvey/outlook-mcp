# Phase 2: Build `graph_call.py` Security Proxy

## Objective

Create `scripts/graph_call.py` — the security boundary that makes authenticated Microsoft Graph API calls without exposing tokens to the LLM or stdout.

## Scope

### Included:
- Create `scripts/graph_call.py` with CLI interface: `python3 scripts/graph_call.py METHOD "/endpoint" ['body'] [--header "K: V"]`
- Venv bootstrap: auto-detect and load `outlook-skills/.venv/` site-packages (Windows + Linux)
- Token acquisition via `token_helper.get_token()` — never exposed in output
- HTTP request via `urllib.request` with Bearer auth injection
- Auto-retry on 401 (refresh token + retry once)
- Structured JSON output: `{"status": N, "data": {...}}` or `{"status": N, "error": "...", "message": "..."}`
- Custom header support (`--header`) for calendar timezone `Prefer` header
- Security hardening: suppress tracebacks, never log/print tokens

### Explicitly NOT included:
- Updating any SKILL.md files to use `graph_call.py` (Phases 3-4)
- Test infrastructure for `graph_call.py` (Phase 5)
- Batch/concurrent request support (future enhancement)

## Key Deliverables

| Deliverable | Format | Location |
|-------------|--------|----------|
| Graph API proxy script | Python | `scripts/graph_call.py` |

## Success Criteria

- ✓ `python3 scripts/graph_call.py GET "/me"` returns `{"status": 200, "data": {"displayName": "...", ...}}` (with valid auth)
- ✓ `python3 scripts/graph_call.py GET "/me"` with expired token auto-refreshes and succeeds
- ✓ `python3 scripts/graph_call.py GET "/me"` with no auth returns `{"status": 401, "error": "auth_required", "message": "Run: bash outlook-skills/auth.sh"}`
- ✓ `python3 scripts/graph_call.py POST "/me/sendMail" '{"message":...}'` sends request with JSON body
- ✓ `python3 scripts/graph_call.py GET "/me/calendarView?..." --header "Prefer: outlook.timezone=\"UTC\""` passes custom header
- ✓ `grep -r "token" scripts/graph_call.py` shows no `print(.*token)` patterns — token never in output
- ✓ On Windows, venv site-packages are correctly found at `outlook-skills/.venv/Lib/site-packages`
- ✓ On Linux/Mac, venv site-packages found at `outlook-skills/.venv/lib/python3.X/site-packages`
- ✓ Invalid method or missing endpoint returns structured error JSON (not a Python traceback)

## Dependencies

### Must Complete Before This Phase:
- Phase 1: `token_helper.py` must be working with keychain-backed secrets; `requirements.txt` must exist and venv must be bootstrappable

### Blocked By:
- Valid authentication (user must have run `bash outlook-skills/auth.sh` at least once for live testing)

### Optional:
- `outlook.py` / `calendar_skill.py` working (for cross-referencing request patterns)

## Skills Required (Broad Categories)

- `python-development`: Building CLI tool with argparse, urllib, structured JSON output
- `security-review`: Ensuring no token leakage in error paths, tracebacks, or edge cases
- `cross-platform`: Handling Windows vs POSIX venv paths

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Token leaks in Python traceback on unhandled exception | Medium | Critical | Wrap entire `main()` in try/except; custom error formatter that strips local variables |
| Venv path detection fails on unusual Python installations | Low | Medium | Fall back to system site-packages; print clear error if `keyring`/`cryptography` not found |
| 401 retry loop (token refresh returns another 401) | Low | Medium | Limit to exactly 1 retry; second 401 returns `auth_required` error |
| Large response bodies cause memory issues | Low | Low | Graph API responses are typically small; no mitigation needed for v1 |

## Assumptions

- `urllib.request` is sufficient for all Graph API calls (no streaming, no file uploads >4MB in v1)
- The venv at `outlook-skills/.venv/` is the canonical location for Python dependencies
- All Graph API responses are JSON (true for v1.0 endpoints used by skills)

## Notes / Design Decisions

- **Why `urllib` not `requests`/`httpx`**: Zero additional dependencies. The venv already has `cryptography` and `keyring`; adding `requests` would be another dep to manage. `urllib.request` handles all needed HTTP methods.
- **Structured output format**: `{"status": N, "data": {...}}` wraps the raw Graph response so the LLM can check status codes without parsing HTTP. For 204 (no content, e.g., sendMail), return `{"status": 204, "data": null}`.
- **No `--verbose` flag**: Intentionally omitted to prevent any mode that could print tokens. Debugging is done via status codes and error messages only.
- **`--header` repeatable**: Support multiple `--header` flags for endpoints needing multiple custom headers.

## Ralph Loops (2)

| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 200 | Build graph_call.py core | Implementation | `scripts/graph_call.py` with venv bootstrap, token acquisition, HTTP methods, structured output |
| 201 | Security hardening & cross-platform | Implementation | Traceback suppression, token-safe error handling, Windows/Linux venv path detection |
