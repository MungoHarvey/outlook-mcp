# Phase 2: Auth & Security Core

## Objective
Close the token-security gaps — no secret at rest, restrictive permissions from creation, a CSRF-safe OAuth callback, and a refresh path that survives on a clean machine — all covered by behavioral tests.

## Scope
### Included:
- **Dependency-free `.env` parser in `token_helper.py` FIRST** (**amendment A1**), mirroring `auth-server.js:loadEnv`, so refresh works without `python-dotenv`. Prove refresh from `.env` alone before anything else in this phase.
- Stop persisting `client_secret` to `tokens.json` (WS2.3) — only after A1 is proven.
- OAuth `state` generate + strict single-use validation + `Host`-header check (WS2.1).
- `mode: 0o600` + `icacls` at token **creation** time (WS2.2).
- HTML-escape callback output; server deadline (10 min) + request timeout (30s) (WS2.4).
- Concurrent-refresh lock + unique tmp filename (WS2.5) — landed **together with 2.3** (shared refresh path).
- `.gitignore` → `tokens.json*` (WS2.6).
- Fix the 401 no-op retry: `get_token(force_refresh=True)` + catch `TokenRefreshError` → 503 (WS3.4).
- Behavioral `token_helper` tests (rest of WS4.2): refresh 200 / invalid_grant / network error, expiry, 30-day wipe — with mocked token endpoint and injected clock (**T2**).

### Explicitly NOT included:
- Public-client/PKCE migration (future option, not required).
- Skill-content fixes (Phase 3).

## Key Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Dependency-free `.env` loader | Code | `outlook-skills/token_helper.py` |
| Secret-free token writer | Code | `outlook-skills/auth-server.js` |
| CSRF-validated callback + timeouts | Code | `outlook-skills/auth-server.js` |
| Mode-600-at-creation | Code | `auth-server.js` + `token_helper.py` |
| Refresh lock + unique tmp | Code | `token_helper.py` |
| force_refresh + 503 mapping | Code | `graph_call.py`, `token_helper.py` |
| Behavioral token tests | Test | `test/python/` |

## Success Criteria
- ✓ A freshly written `tokens.json` contains no `client_secret` and is mode 600.
- ✓ Refresh succeeds on a machine **without** `python-dotenv` installed (env parsed by the new loader).
- ✓ OAuth callback rejects a request with a missing/mismatched `state` and a non-localhost `Host`.
- ✓ A 401 from Graph triggers a real forced refresh (verified with a mocked expired-then-valid token), not a replay.
- ✓ Concurrent `graph_call.py` invocations don't corrupt `tokens.json` (stress test).
- ✓ Behavioral tests cover refresh success, `invalid_grant`, network error, and 30-day wipe; `npm test` green.

## Dependencies
### Must Complete Before:
- Phase 1: scope set stable (refresh tests assume the final scope list).

### Blocked By:
- A1 `.env` loader must merge before 2.3 within this phase (internal ordering).

### Optional:
- `base64url`/Node-engine bump (A8) can ride along here or Phase 4.

## Skills Required (Broad Categories)
- `oauth-security`: state validation, CSRF, secret handling.
- `python-tooling`: token_helper refactor + pytest with mocks/clock injection.
- `node-http`: auth-server callback hardening.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Dropping secret kills refresh on clean machine | High | High | A1 `.env` parser first; prove refresh before 2.3 |
| Existing token files still carry the secret | High | Low | Old files keep working; `--reauth` is the clean cutover; document |
| Refresh-lock deadlock across Python/Node | Low | Med | Advisory lock with timeout; re-check expiry under lock |
| Tests flaky on real `icacls`/wall-clock | Med | Low | Assert mode logic via seam; inject clock, never sleep (T2) |

## Assumptions
- `.env` client identity matches the tokens' `client_id`/`tenant_id` (**C3** invariant) — document; refresh fails clearly if not.

## Notes / Design Decisions
- 2.3 + 2.5 land together because both rewrite the refresh/persist path.
- Riskiest change in the whole programme (A1/C1 interaction) lives here and is gated by proving the `.env` path first.

## Ralph Loops (4)
| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 200 | Dependency-free `.env` loader + prove refresh | Implementation | token_helper env parser + test |
| 210 | Drop client_secret + refresh lock | Implementation | secret-free writer, locked refresh |
| 220 | Callback hardening (state/host/escape/timeouts) | Implementation | auth-server.js |
| 230 | force_refresh + behavioral token tests | Implementation | 401 retry fix, pytest suite |
