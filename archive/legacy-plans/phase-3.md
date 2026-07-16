# Phase 3: Update Auth, Base, and Operation Skills

## Objective

Migrate all 18 `.claude/skills/` SKILL.md and reference.md files from plaintext `$TOKEN` + curl patterns to the secure `graph_call.py` proxy, ensuring existing skill logic (confirmation flows, response parsing, parameter docs) is preserved.

## Scope

### Included:
- Rewrite `outlook-auth/SKILL.md` and `reference.md` for new `auth.sh` + `graph_call.py` flow
- Rewrite `outlook-base/SKILL.md` and `reference.md` — replace TOKEN/curl templates with `graph_call.py` patterns
- Update all 16 operation skill SKILL.md files: remove `TOKEN=$(...)` blocks, replace curl with `graph_call.py`
- Update any `reference.md` files that contain `$TOKEN` or `curl -H "Authorization: Bearer $TOKEN"` patterns
- Add explicit token safety rules to `outlook-base/SKILL.md`
- Update `outlook-references/errors.yaml` auto-retry pattern (proxy handles retries internally)

### Explicitly NOT included:
- Modifying `graph_call.py` itself (Phase 2)
- Creating new security tests (Phase 5)
- Updating CLAUDE.md, package.json, .gitignore (Phase 5)

## Key Deliverables

| Deliverable | Format | Location |
|-------------|--------|----------|
| Rewritten auth skill | Markdown | `.claude/skills/outlook-auth/SKILL.md` + `reference.md` |
| Rewritten base skill | Markdown | `.claude/skills/outlook-base/SKILL.md` + `reference.md` |
| Updated email skills (x7) | Markdown | `.claude/skills/outlook-email-*/SKILL.md` |
| Updated calendar skills (x4) | Markdown | `.claude/skills/outlook-calendar-*/SKILL.md` |
| Updated contacts skills (x2) | Markdown | `.claude/skills/outlook-contacts-*/SKILL.md` |
| Updated folders skill | Markdown | `.claude/skills/outlook-folders/SKILL.md` |
| Updated rules skill | Markdown | `.claude/skills/outlook-rules/SKILL.md` |
| Updated categories skill | Markdown | `.claude/skills/outlook-categories/SKILL.md` |

## Success Criteria

- ✓ `grep -r '$TOKEN' .claude/skills/` returns zero matches
- ✓ `grep -r 'outlook-mcp-tokens.json' .claude/skills/` returns zero matches
- ✓ `grep -r 'node scripts/outlook-auth-server' .claude/skills/` returns zero matches
- ✓ `grep -r 'node scripts/outlook-token-refresh' .claude/skills/` returns zero matches
- ✓ Every operation SKILL.md contains `python3 scripts/graph_call.py` as the API call pattern
- ✓ `outlook-auth/SKILL.md` references `bash outlook-skills/auth.sh` for all auth operations
- ✓ `outlook-base/SKILL.md` contains explicit rule: "Never attempt to read tokens directly"
- ✓ All SAFETY confirmation blocks preserved in destructive skills (send, delete, reply, move, calendar-create, calendar-update, calendar-respond, folders, rules)
- ✓ All YAML frontmatter (`name`, `description`, `user_invocable`) unchanged in every SKILL.md
- ✓ `npm run test:static` passes (skill structure tests still valid)

## Dependencies

### Must Complete Before This Phase:
- Phase 1: Auth foundation files fixed and working
- Phase 2: `scripts/graph_call.py` created and tested — skills will reference it

### Blocked By:
- Nothing beyond Phase 2 completion

### Optional:
- Live auth token for manual smoke testing of updated skills

## Skills Required (Broad Categories)

- `markdown-editing`: Systematic find-and-replace across 20+ markdown files
- `api-patterns`: Understanding Graph API endpoint patterns to correctly translate curl → graph_call.py
- `security-review`: Verifying no token exposure patterns survive in any skill file

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Missing a `$TOKEN` reference in a skill file | Medium | High | Use `grep -r` verification as success criterion; run security tests in Phase 5 |
| Breaking SAFETY confirmation flows during migration | Low | High | Only change the API call line; preserve all text above/below the curl block |
| Calendar timezone `Prefer` header migration | Medium | Medium | `graph_call.py` supports `--header`; translate `-H "Prefer: ..."` to `--header "Prefer: ..."` |
| Response parsing breaks (skills expect raw JSON, proxy wraps in `{"status":..,"data":..}`) | Medium | High | Update response parsing in base reference.md to extract `.data` field; skills follow base patterns |

## Assumptions

- All 16 operation skills follow the same pattern: TOKEN block at top, then curl commands. Validated by reading multiple SKILL.md files.
- YAML frontmatter in SKILL.md files does not need to change — only the body content.
- The `graph_call.py` output format `{"status": N, "data": {...}}` is stable from Phase 2.

## Notes / Design Decisions

- **Auth skill is rewritten, not just patched**: The auth flow changes fundamentally (Node.js server → Python auth.sh). A full rewrite is cleaner than surgical edits.
- **Base skill rewrite cascades to all skills**: Since every skill references `outlook-base/SKILL.md` and its `reference.md` for curl templates, updating base means all skills inherit the new patterns. Individual skill updates are then minimal (just the specific curl command lines).
- **Preserve reference.md structure**: Keep OData query parameters, pagination, and throttling sections unchanged in `outlook-base/reference.md` — only replace the curl template blocks and auto-retry pattern.
- **Batch approach for 16 skills**: Group by domain (email x7 → calendar x4 → contacts x2 → folders/rules/categories x3) and process each group as a loop.

## Ralph Loops (4)

| Loop | Name | Type | Key Outputs |
|------|------|------|-------------|
| 300 | Rewrite auth & base skills | Migration | `outlook-auth/SKILL.md`, `reference.md`, `outlook-base/SKILL.md`, `reference.md` |
| 301 | Migrate email skills (x7) | Migration | All `outlook-email-*/SKILL.md` updated to use `graph_call.py` |
| 302 | Migrate calendar + contacts skills (x6) | Migration | All `outlook-calendar-*/SKILL.md` and `outlook-contacts-*/SKILL.md` updated |
| 303 | Migrate folders, rules, categories + verify | Migration | `outlook-folders/`, `outlook-rules/`, `outlook-categories/` updated; `grep` verification pass |
