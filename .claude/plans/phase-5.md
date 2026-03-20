# Phase 5: Security Tests, Project Files & Validation

## Objective

Add security test coverage to prevent token leakage regressions, update existing tests for the new `graph_call.py` patterns, update project documentation (CLAUDE.md, .gitignore, package.json), and deprecate the old Node.js auth scripts.

## Scope

### Included:
- Create `test/static/security.test.js` — token leak prevention tests across all skills
- Rewrite `test/eval/curl-structure.test.js` → `test/eval/api-call-structure.test.js` for `graph_call.py` patterns
- Update `test/unit/auth-server.test.js` and `test/unit/token-refresh.test.js` for new auth system
- Update `test/integration/smoke.test.js` to use `graph_call.py` instead of direct curl + token
- Update `CLAUDE.md` — new security architecture, `graph_call.py` patterns, remove old token references
- Update `.gitignore` — add `outlook-skills/.venv/`, `*.enc`
- Update `package.json` — add `test:security` script
- Deprecate `scripts/outlook-auth-server.js` and `scripts/outlook-token-refresh.js` (add deprecated header)
- Full verification pass: `npm test` + `grep` scans

### Explicitly NOT included:
- Modifying `graph_call.py` or auth Python files (Phases 1-2)
- Modifying any SKILL.md files (Phase 3)
- Deleting deprecated Node.js scripts (future cleanup)

## Key Deliverables

| Deliverable | Format | Location |
|-------------|--------|----------|
| Security test suite | JavaScript (node:test) | `test/static/security.test.js` |
| API call structure tests | JavaScript (node:test) | `test/eval/api-call-structure.test.js` |
| Updated unit tests | JavaScript (node:test) | `test/unit/auth-server.test.js`, `token-refresh.test.js` |
| Updated integration tests | JavaScript (node:test) | `test/integration/smoke.test.js` |
| Updated project docs | Markdown | `CLAUDE.md` |
| Updated gitignore | Text | `.gitignore` |
| Updated package config | JSON | `package.json` |
| Deprecated old scripts | JavaScript | `scripts/outlook-auth-server.js`, `scripts/outlook-token-refresh.js` |

## Success Criteria

- ✓ `npm run test:static` passes including new security tests
- ✓ `test/static/security.test.js` verifies: no SKILL.md contains `get_token`, `token_helper`, `$TOKEN`, `access_token`, or `outlook-mcp-tokens.json`
- ✓ `test/eval/api-call-structure.test.js` validates `graph_call.py` invocation patterns in all operation skills
- ✓ `npm test` passes all suites (static + unit + eval)
- ✓ `CLAUDE.md` references `graph_call.py` as the API call mechanism (not curl + $TOKEN)
- ✓ `CLAUDE.md` documents the security architecture (encrypted tokens, keychain, proxy boundary)
- ✓ `.gitignore` includes `outlook-skills/.venv/` and `*.enc`
- ✓ `scripts/outlook-auth-server.js` and `scripts/outlook-token-refresh.js` have `// DEPRECATED` header
- ✓ `OUTLOOK_INTEGRATION_TEST=true npm run test:integration` passes (with valid auth)

## Dependencies

### Must Complete Before This Phase:
- Phase 1: Auth foundation working
- Phase 2: `graph_call.py` created
- Phase 3: All SKILL.md files migrated to `graph_call.py` patterns

### Blocked By:
- Nothing beyond Phase 3 completion

### Optional:
- Valid auth token for running integration smoke tests

## Skills Required (Broad Categories)

- `javascript-testing`: Writing `node:test` assertions, YAML fixture files
- `security-review`: Designing token leak detection tests
- `documentation`: Updating CLAUDE.md security architecture section
- `project-config`: Updating package.json scripts, .gitignore patterns

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Security test regex too strict (false positives) | Medium | Low | Use targeted patterns: `get_token\(` not just `get_token`; exclude comments and this test file itself |
| Existing tests break due to skill content changes | High | Medium | Expected — rewrite curl-structure tests to match new patterns. Run `npm test` after each change. |
| Integration tests fail if auth has changed | Medium | Medium | Update smoke tests to use `graph_call.py` for API calls; remove direct token file reads |
| Deprecation breaks something that imports old scripts | Low | Low | Only add a comment header; don't change exports or functionality |

## Assumptions

- All SKILL.md files have been successfully migrated in Phase 3 before these tests run
- The `node:test` runner and `js-yaml` dev dependency remain the test infrastructure
- Integration tests remain opt-in via `OUTLOOK_INTEGRATION_TEST=true`

## Notes / Design Decisions

- **Security tests in `test/static/`**: These are structural lint tests (grep-based), not runtime tests. They scan file contents for forbidden patterns. This matches the existing `test/static/skill-structure.test.js` pattern.
- **Rename `curl-structure.test.js`**: Since skills no longer use curl, the test file name should reflect the new pattern. Renaming to `api-call-structure.test.js` is clearer.
- **Deprecate, don't delete**: Old Node.js scripts may be referenced in users' workflows or docs outside this repo. Adding a `// DEPRECATED` header is safe; deletion can happen in a future cleanup PR.
- **CLAUDE.md is the single source of truth**: Future Claude Code instances read CLAUDE.md first. Updating it with the security architecture ensures all future sessions use `graph_call.py` correctly.

## Ralph Loops (3)

| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 500 | Security & API call tests | Implementation | `test/static/security.test.js`, `test/eval/api-call-structure.test.js` |
| 501 | Update unit + integration tests | Implementation | Updated `test/unit/*.test.js`, `test/integration/smoke.test.js` |
| 502 | Project files & final verification | Implementation | Updated `CLAUDE.md`, `.gitignore`, `package.json`; deprecated old scripts; full `npm test` pass |
