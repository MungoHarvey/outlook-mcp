# Phase 3: Skill Content Correctness

## Objective
Make the copyable examples in every skill actually run and honor the security model — no curl+Bearer, correct response parsing, shell-safe OData, and accurate status codes.

## Scope
### Included:
- Rewrite all **17 `curl -H "Authorization: Bearer $TOKEN"` examples** to `graph_call.py` calls across 7 `reference.md` files (WS3.1).
- Fix the **8 parsing templates** that omit the `{"status","data"}` unwrap (WS3.2).
- Escape `$select/$top/$orderby` and `%20`-encode spaces in ~10 bash examples (WS3.3).
- Batch smaller fixes (WS3.5): `-H`→`--header`, wrong success codes (202/201 not 204/200), PowerShell `${VAR}`→`$env:VAR`, relative script path→`$CLAUDE_PLUGIN_ROOT`, dangling `curl -d` fragments, invalid rules example.
- Disambiguate the 4 overlapping auto-trigger descriptions (WS3.6).

### Explicitly NOT included:
- Reference-file deduplication (Phase 4) — content is fixed **before** dedup so fixes aren't applied to soon-deleted copies.
- Doc/README rewrites (Phase 5).

## Key Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| 17 curl→graph_call.py rewrites | Markdown | 7 `skills/*/reference.md` |
| 8 unwrap-corrected templates | Markdown | affected reference.md |
| Escaped OData examples | Markdown | base, email-list, folders, calendar-list, email-draft |
| Batched correctness fixes | Markdown | multiple SKILL.md/reference.md |
| Disambiguated descriptions | YAML frontmatter | 4 SKILL.md |

## Success Criteria
- ✓ `grep -rn "Bearer" skills/` and `grep -rn "curl " skills/` return nothing.
- ✓ Each fixed parsing template, run against real `graph_call.py` output, produces the intended value (spot-check list/read/reply/folders).
- ✓ Flagship `email-list` command with `$select` returns trimmed fields (no InvalidURL 500, no full objects).
- ✓ Security static test extended to scan `reference.md`/`params.yaml`/`references/*.yaml`, not just SKILL.md, and passes.
- ✓ `npm test` green; eval tests pass.

## Dependencies
### Must Complete Before:
- Phase 1 (endpoint guard) and Phase 2 (proxy behavior) so examples target final runtime behavior.

### Blocked By:
- None.

### Optional:
- None.

## Skills Required (Broad Categories)
- `technical-writing`: skill examples and templates.
- `graph-api`: correct endpoints, verbs, status codes, OData.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| A rewritten example still wrong at runtime | Med | Med | Spot-check representative templates against live proxy output |
| Description disambiguation misroutes a skill | Low | Med | Keep trigger words unique; add eval assertion for uniqueness |
| Fixes land on copies about to be deleted | Med | Low | Sequenced before Phase 4 dedup by design |

## Assumptions
- Existing payload JSON in the curl blocks is valid Graph JSON and can be reused verbatim in `graph_call.py` positional-body form.

## Notes / Design Decisions
- This is the largest single workstream but internally uniform; batch by file to keep loops tractable.
- Must precede dedup (Phase 4) — otherwise a fix like `-H`→`--header` has to be applied twice.

## Ralph Loops (3)
| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 300 | curl→graph_call.py + unwrap templates | Implementation | 17 rewrites, 8 template fixes |
| 310 | OData escaping + batched correctness fixes | Implementation | escaped examples, status codes, PS vars |
| 320 | Description disambiguation + security-scan test | Implementation | frontmatter fixes, extended static test |
