# Phase 1: Unblock Skills & Lock Scopes

## Objective
Make every shipped skill actually reachable — request the scopes the skills need, fix the Windows path bug that breaks all writes, and lock both behind tests so they can't silently regress.

## Scope
### Included:
- Add `Contacts.ReadWrite` + `MailboxSettings.ReadWrite` to the auth scope set (WS1.1) and commit the already-made `openid/profile/email` addition (WS1.4).
- Single-source the scope list (WS5.2, **merged in per amendment A2**) — one canonical source consumed by `auth-server.js`, docs generated/greped from it.
- Merge the Windows MSYS path self-heal (WS1.2) and the segment-exact endpoint validation (WS1.3) into **one atomic rewrite** of the `graph_call.py` endpoint guard (**amendment A3**).
- Scope-contract test (WS4.3): derive required Graph scope from each SKILL.md verb+endpoint, assert `SCOPES` covers it; **fail-closed on unknown endpoints; map GET verbs to read-tier scopes** (**amendment A5, C2**).
- Endpoint-validation table test (part of WS4.2) with Git-Bash-mangled inputs as fixtures.
- Minimal CI change to actually run Python (`python -m py_compile` step).
- Re-auth migration banner (**C1**): compare stored `tokens.json.scopes` against required `SCOPES`; surface "re-auth needed for new permissions" instead of a silent 403.

### Explicitly NOT included:
- Security hardening of the auth server (Phase 2).
- Skill-content example rewrites (Phase 3).
- Reference-file deduplication (Phase 4).

## Key Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Canonical scope source | JSON or JS const | `outlook-skills/scopes.json` (or shared module) |
| Updated scope set (2 new scopes + openid/profile/email) | Code | `outlook-skills/auth-server.js` |
| Atomic endpoint-guard rewrite (MSYS self-heal + segment-exact) | Code | `scripts/graph_call.py` |
| Scope-contract test (fail-closed) | Test | `test/` (new) |
| Endpoint-validation table test | Test | `test/python/` (new) |
| Re-auth scope-drift banner | Code | `outlook-skills/token_helper.py` / `auth-server.js --status` |
| CI Python compile step | YAML | `.github/workflows/test.yml` |

## Success Criteria
- ✓ `python scripts/graph_call.py GET "/me"` returns HTTP 200 from Windows Git Bash **without** `MSYS_NO_PATHCONV=1`.
- ✓ Endpoint guard rejects `/messages`, `/memberOf`, and double-encoded traversal; accepts `/me`, `/me/messages`, `/users/...`.
- ✓ Scope-contract test passes and fails if any skill's verb+endpoint needs an unrequested scope (verified by temporarily removing a scope).
- ✓ Scope list appears in exactly one editable source; docs derive from it.
- ✓ Running against a stale `tokens.json` (missing new scopes) prints a re-auth prompt rather than 403ing at call time.
- ✓ `npm test` green, including the new Python compile step in CI.

## Dependencies
### Must Complete Before:
- (none — this is the first phase and a hard prerequisite for the rest)

### Blocked By:
- Nothing external. Requires a working Azure app registration (already present).

### Optional:
- Documenting the re-auth step in user-facing docs (fuller treatment in Phase 5).

## Skills Required (Broad Categories)
- `python-tooling`: graph_call.py validation rewrite + pytest tier.
- `oauth-config`: scope set and Graph permission mapping.
- `ci-cd`: GitHub Actions Python step.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Greedy MSYS path-strip re-opens traversal hole | Med | High | Single atomic rewrite; table test with malicious + mangled fixtures (A3) |
| Scope→endpoint map drifts as skills change | Med | Med | Fail-closed test: unknown endpoint => failure demanding a map entry (A5) |
| Existing users keep 403ing after update | High | Med | Scope-drift banner + documented `--reauth` (C1) |
| New scopes need admin consent on some tenants | Low | Med | Delegated user-consentable scopes; note tenant-policy caveat in docs |

## Assumptions
- `MailboxSettings.ReadWrite` supersets `MailboxSettings.Read`, covering both rules/categories read and write. Validate against a live `--reauth` + list-rules call.
- The user's tenant allows user consent for the added delegated scopes (true for the current Edinburgh tenant; may differ elsewhere).

## Notes / Design Decisions
- Merging 5.2 into this phase (A2) avoids editing 5 scope copies then deleting 4 next phase.
- The endpoint guard is the sole runtime barrier on which Graph paths are reachable; it gets fuzz/table testing, not a spot check.

## Ralph Loops (4)
| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 100 | Single-source scopes + add missing | Implementation | scopes.json, auth-server.js, doc generation |
| 110 | Endpoint-guard atomic rewrite | Implementation | graph_call.py validation + fixtures |
| 120 | Scope-contract + endpoint-validation tests | Implementation | fail-closed tests, CI python step |
| 130 | Re-auth scope-drift migration banner | Implementation | token_helper/status banner |
