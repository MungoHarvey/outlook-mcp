---
name: trailofbits-fix-review
description: "Verify that fix commits address security findings without introducing new vulnerabilities. Use after applying patches to confirm correctness."
user_invocable: true
stub: true
stub_reason: "Remote fetch 404'd (trailofbits/skills main and master branches). Stub created per plan fallback."
---

# Trail of Bits: Fix Review

**Status**: Stub — remote skill unavailable (404 on fetch attempt 2026-03-20)

## Purpose

Review applied security fixes to verify:
1. The fix correctly addresses the reported finding
2. No new vulnerabilities are introduced by the fix
3. The fix matches the recommended remediation in the audit report

## Manual Review Protocol

For each fixed finding, verify:

### Fix 3 — Endpoint prefix validation (`graph_call.py`)
- [ ] Validation occurs before URL construction
- [ ] `/me` and `/users/` prefixes both allowed (needed by skills)
- [ ] Returns structured `{"status": 400, "error": "invalid_endpoint"}` — not a thrown exception
- [ ] `make_request()` returns early (does not proceed to token acquisition after rejection)
- [ ] No path-traversal bypass: `//me`, `/ME`, `/me.attacker.com` — check `startswith` is sufficient

### Fix 5 — CSRF state comparison (`auth_runner.py`)
- [ ] `hmac.compare_digest(a, b)` used (not `==` or `!=`)
- [ ] Both arguments are strings (not bytes) — `compare_digest` accepts both but must match types
- [ ] `result.get("state", "")` default prevents `TypeError` when state key absent
- [ ] `import hmac` present at module level

### Fix 7 — Config file path injection (`auth.sh`)
- [ ] `$CONFIG_FILE` is NOT interpolated inside any Python string literal
- [ ] File path passed as `sys.argv[1]` only
- [ ] Heredoc uses single-quoted delimiter (`<< 'PYEOF'`) to prevent shell expansion in body
- [ ] `python3` used (not `python`) for consistency with rest of codebase
- [ ] Script reads from stdin (`-`) correctly

## Threat Model Cross-Reference

| Finding | File | Status after fix |
|---|---|---|
| 3 | `scripts/graph_call.py:96` | Endpoint gated to `/me` and `/users/` |
| 5 | `outlook-skills/auth_runner.py:362` | Timing-safe comparison |
| 7 | `outlook-skills/auth.sh:114` | No string interpolation |
