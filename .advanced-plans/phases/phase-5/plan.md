# Phase 5: Documentation Truth

## Objective
Make every doc describe the system that actually exists — correct redirect URI, honest security claims, accurate architecture and counts — now that the code behavior is final.

## Scope
### Included:
- Rewrite or delete `outlook-skills/README.md` and `setup/README.md` (WS6.1): remove false claims (AES-256, OS keychain, PKCE, "secret never written to disk"), fix redirect URI `/callback`→`/auth/callback`.
- Fix `outlook-auth/reference.md` (WS6.2): correct redirect URI; replace the `~/.skills/config.json` instructions with the real `.env` flow; drop `MS_TENANT_ID`.
- Rewrite root `README.md` (WS6.3): skills + `graph_call.py` architecture (not "two MCP tools"), correct skill count (20/18-invocable), correct artifact name, fix the broken `#quick-start` anchor.
- Fix `CLAUDE.md` (WS6.4): remove the uv/.venv bootstrap fiction; describe the real Node-only auth + `pip install` dependency path; add/label `mcp-server/`, `.mcp.json`, `setup/` per the **Phase 4 mcp-server decision**; qualify the "all calls via graph_call.py" claim.
- Sweep stale planning/research debris (WS6.5): move `.claude/plans/` + `research/` MCP-era files to the parent repo or archive; `git rm --cached` committed `loop-complete*.json`; ensure deleted deprecated scripts aren't "resurrected" by old loop files.

### Explicitly NOT included:
- Any code/behavior change — docs only. If a doc can't truthfully describe behavior, that's a bug to file, not to fix here.

## Key Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Truthful setup/auth READMEs | Markdown | `outlook-skills/README.md`, `setup/README.md` |
| Corrected auth reference | Markdown | `skills/outlook-auth/reference.md` |
| Rewritten root README | Markdown | `README.md` |
| Corrected CLAUDE.md | Markdown | `CLAUDE.md` |
| Debris swept | Repo state | `.claude/plans/`, `research/` |

## Success Criteria
- ✓ The redirect URI string `http://localhost:8400/auth/callback` appears everywhere it's documented; `/callback` alone appears nowhere (enforced by the Phase 4 doc-consistency test).
- ✓ No doc claims AES-256/keychain/PKCE or "secret never written to disk."
- ✓ Skill count in docs matches the real folder count.
- ✓ CLAUDE.md's architecture tree and setup steps match the actual repo (Node-only auth, real dependency path, mcp-server present-or-removed per decision).
- ✓ No committed `loop-complete*.json`; MCP-era debris archived or moved.
- ✓ `npm test` green (doc-consistency test passes).

## Dependencies
### Must Complete Before:
- Phase 4 — the `mcp-server/` fate decision and the doc-consistency test both come from Phase 4.

### Blocked By:
- None.

### Optional:
- None.

## Skills Required (Broad Categories)
- `technical-writing`: user-facing docs.
- `repo-hygiene`: debris sweep, gitignore/tracked-file cleanup.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Doc rewrite drifts from final behavior | Low | Med | Docs written last, against shipped code; consistency test guards URIs/scopes |
| Deleting plans breaks a running ralph loop | Low | Low | Archive rather than hard-delete; verify no active loop references |
| mcp-server doc contradiction resurfaces | Med | Low | Single Phase-4 decision is the source of truth for 6.4/6.5 |

## Assumptions
- By this phase, code behavior is frozen, so docs can describe a stable target.

## Notes / Design Decisions
- Docs come last precisely so they describe final behavior and don't create a second drift.
- The doc-consistency test (built in Phase 4) is what keeps this phase from re-drifting.

## Ralph Loops (3)
| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 500 | Rewrite setup/auth READMEs + auth reference | Implementation | truthful setup docs, correct URI/.env flow |
| 510 | Rewrite root README + CLAUDE.md | Implementation | correct architecture, counts, tree |
| 520 | Sweep planning/research debris | Migration | archived plans, untracked loop JSONs |
