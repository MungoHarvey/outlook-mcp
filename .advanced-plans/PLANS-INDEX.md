# Plans Index — Code-Review Remediation

Programme: bring `outlook-mcp-skills` from "several skills silently broken + pervasive doc/security drift" to "functional, safe, tested, de-duplicated."

Source master plan: `.claude/plans/master-plan-review-remediation.md` (goal, 60 findings, review amendments A1–A8, migration/rollout).

## Phases

| Phase | Name | Status | Objective | Ships |
|-------|------|--------|-----------|-------|
| 1 | Unblock Skills & Lock Scopes | pending | Request needed scopes, fix Windows path bug, guard both with tests | Every skill reachable; Windows writes work |
| 2 | Auth & Security Core | pending | No secret at rest, mode-600, CSRF-safe callback, refresh survives clean machine | Hardened, tested auth |
| 3 | Skill Content Correctness | pending | Runnable examples honoring the security model | No curl/Bearer; correct parsing |
| 4 | Deduplication & Tooling | pending | One source for refs/version/constants; dead code gone; CI trustworthy | −56 KB dup; cross-platform CI |
| 5 | Documentation Truth | pending | Docs match reality | Honest, consistent docs |

## Ralph Loops (18 total)

| Loop | Phase | Name | Recovery |
|------|-------|------|----------|
| 100 | 1 | Single-source scopes + add missing permissions | escalate |
| 110 | 1 | Endpoint-guard atomic rewrite (MSYS + segment-exact) | escalate |
| 120 | 1 | Scope-contract + endpoint-validation tests + CI python | escalate |
| 130 | 1 | Re-auth scope-drift migration banner | escalate |
| 200 | 2 | Dependency-free .env loader + prove refresh | escalate |
| 210 | 2 | Drop client_secret + refresh lock + mode-600 | escalate |
| 220 | 2 | Callback hardening — state, host, escaping, timeouts | escalate |
| 230 | 2 | Force-refresh on 401 + behavioral token tests | escalate |
| 300 | 3 | curl→graph_call.py rewrites + .data unwrap templates | escalate |
| 310 | 3 | OData escaping + batched correctness fixes | escalate |
| 320 | 3 | Description disambiguation + security-scan test | escalate |
| 400 | 4 | Dedup references into outlook-base + link-resolution test | checkpoint |
| 410 | 4 | Single-source version + 30-day constant + engines bump | escalate |
| 420 | 4 | Remove deprecated code + fix test globs | escalate |
| 430 | 4 | Setup fixes + CI matrix/linters + doc test + mcp-server decision | escalate |
| 500 | 5 | Rewrite setup/auth READMEs + auth reference | escalate |
| 510 | 5 | Rewrite root README + CLAUDE.md | escalate |
| 520 | 5 | Sweep planning/research debris | checkpoint |

Loop files: `.advanced-plans/phases/phase-{1..5}/loops.md`

## Sequencing
P1 → P2 → P3 → P4 → P5 (strict; each independently shippable and green on `npm test`).

Key cross-phase constraints:
- P1 merges scope single-sourcing (A2) so P4 doesn't re-touch scope copies.
- P2 lands the dependency-free `.env` parser (A1) before dropping `client_secret`.
- P3 (content) precedes P4 (dedup) so fixes aren't applied to soon-deleted copies.
- P4 decides `mcp-server/` fate (A7); P5 docs consume that decision.

## Next step
Decompose each phase into executable ralph loops with `ralph-loop-planner` (or `/decompose-phase`), starting with Phase 1.
