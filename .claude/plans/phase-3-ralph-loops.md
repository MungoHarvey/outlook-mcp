---
loop: ralph-loop-300
name: Rewrite Auth and Base Skills
task_name: Rewrite Auth and Base Skills
max_iterations: 6
on_max_iterations: escalate
handoff_summary:
  done: "Rewrote outlook-auth/SKILL.md and reference.md for auth.sh flow; rewrote outlook-base/SKILL.md with graph_call.py pattern and token safety rule; updated outlook-base/reference.md with graph_call.py templates and .data parsing note; fixed TOKEN patterns in outlook-references."
  failed: ""
  needed: "Loop 301 should migrate all 7 outlook-email-* SKILL.md files from TOKEN/curl to graph_call.py."
todos:
  - id: "300-1"
    content: "Read outlook-auth/SKILL.md and rewrite its body to use 'bash outlook-skills/auth.sh' for all auth operations: check status (--status), authenticate, force re-login (--reauth), revoke (--revoke), verify API access via 'python3 scripts/graph_call.py GET /me'; remove all references to node scripts/outlook-auth-server.js, ~/.outlook-mcp-tokens.json, and TOKEN=$(...) patterns"
    skill: "outlook-auth"
    agent: "worker"
    outcome: "outlook-auth/SKILL.md body references bash outlook-skills/auth.sh for all operations and python3 scripts/graph_call.py for API verification; zero references to node scripts, TOKEN=, or outlook-mcp-tokens.json"
    status: completed
    priority: high
  - id: "300-2"
    content: "Read outlook-auth/reference.md and update: change redirect URI to http://localhost:8400/callback, change config path to ~/.skills/config.json, remove token file structure section, keep Azure app permissions list; remove all references to .env, port 3333, and plaintext token storage"
    skill: "outlook-auth"
    agent: "worker"
    outcome: "outlook-auth/reference.md shows localhost:8400 redirect URI, ~/.skills/config.json config path, and contains no .env, port 3333, or plaintext token references"
    status: completed
    priority: high
  - id: "300-3"
    content: "Read outlook-base/SKILL.md and rewrite: remove the TOKEN=$(...) block entirely, replace curl patterns with 'python3 scripts/graph_call.py METHOD /endpoint [body] [--header K:V]', add an explicit token safety rule: 'Never attempt to read tokens directly, import token_helper, or call get_token(). Always use scripts/graph_call.py for all API calls.'"
    skill: "outlook-base"
    agent: "worker"
    outcome: "outlook-base/SKILL.md contains the graph_call.py pattern, the explicit token safety rule, and zero TOKEN=$(...) blocks or curl -H Authorization patterns"
    status: completed
    priority: high
  - id: "300-4"
    content: "Read outlook-base/reference.md and rewrite the four curl template blocks (GET/POST/PATCH/DELETE) to use graph_call.py equivalents; update response parsing section to extract .data field from {\"status\": N, \"data\": {...}} output; update auto-retry section to note that graph_call.py handles 401 retry internally; keep OData query parameters, pagination, and throttling sections unchanged"
    skill: "outlook-base"
    agent: "worker"
    outcome: "outlook-base/reference.md has graph_call.py templates for all four HTTP methods, a .data extraction note in response parsing, and a note that 401 retry is handled by the proxy; OData, pagination, and throttling sections are intact and unchanged"
    status: completed
    priority: high
  - id: "300-5"
    content: "Check outlook-references/errors.yaml for any auto-retry-on-401 instructions and update to note that graph_call.py handles 401 retry internally; check all other files in outlook-references/ for $TOKEN or curl -H Authorization patterns and update any found"
    skill: "NA"
    agent: "worker"
    outcome: "outlook-references/errors.yaml contains no instruction for the LLM to manually retry on 401; zero $TOKEN or curl -H Authorization patterns remain in any outlook-references/ file"
    status: completed
    priority: high
  - id: "300-6"
    content: "Verify loop 300 changes: grep -r 'TOKEN=' .claude/skills/outlook-auth/ .claude/skills/outlook-base/ .claude/references/ returns zero matches; grep -r 'outlook-mcp-tokens.json' same dirs returns zero; grep -r 'node scripts/outlook-auth-server' same dirs returns zero; grep -r 'graph_call.py' .claude/skills/outlook-base/SKILL.md returns at least one match"
    skill: "NA"
    agent: "worker"
    outcome: "Zero TOKEN=, outlook-mcp-tokens.json, and node scripts references in auth and base skill dirs; graph_call.py appears in outlook-base/SKILL.md"
    status: completed
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Rewrite outlook-auth and outlook-base skills to use the new auth.sh + graph_call.py security architecture, replacing all TOKEN/$(..) and curl patterns with the secure proxy interface.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-300"

  ## Success criteria
  - [ ] outlook-auth/SKILL.md uses bash outlook-skills/auth.sh for all auth ops
  - [ ] outlook-auth/reference.md updated: port 8400, ~/.skills/config.json, no .env
  - [ ] outlook-base/SKILL.md has graph_call.py pattern + explicit token safety rule
  - [ ] outlook-base/reference.md has graph_call.py templates for GET/POST/PATCH/DELETE + .data parsing note
  - [ ] outlook-references/ has no $TOKEN or curl Authorization patterns
  - [ ] grep TOKEN= in auth+base dirs = 0; grep graph_call.py in outlook-base/SKILL.md >= 1

  ## Required skills
  - outlook-auth: Reference for auth flow operations
  - outlook-base: Reference for base pattern structure

  ## Inputs
  - .claude/skills/outlook-auth/SKILL.md (current)
  - .claude/skills/outlook-auth/reference.md (current)
  - .claude/skills/outlook-base/SKILL.md (current)
  - .claude/skills/outlook-base/reference.md (current)
  - .claude/skills/outlook-references/*.yaml (scan for TOKEN patterns)
  - scripts/graph_call.py (the new interface — read to understand the exact CLI)

  ## Expected outputs
  - .claude/skills/outlook-auth/SKILL.md (rewritten)
  - .claude/skills/outlook-auth/reference.md (updated)
  - .claude/skills/outlook-base/SKILL.md (rewritten)
  - .claude/skills/outlook-base/reference.md (updated)

  ## Constraints
  - YAML frontmatter (name, description, user_invocable) must remain unchanged in all SKILL.md files
  - Preserve any existing sections not related to TOKEN/curl (e.g. parameter docs, flow descriptions)
  - graph_call.py CLI: python3 scripts/graph_call.py METHOD "/endpoint" ['body'] [--header "K: V"]
  - Response format from proxy: {"status": N, "data": {...}} — skills must parse .data field

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-300 — auth and base skills migrated to graph_call.py"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 300 rewrites the two foundational skills — `outlook-auth` and `outlook-base` — to use the new secure architecture. Auth skill switches from Node.js server to `bash outlook-skills/auth.sh`. Base skill replaces the `TOKEN=$(...)` + curl templates with `python3 scripts/graph_call.py` patterns. Since all 16 operation skills reference `outlook-base`, this establishes the pattern all subsequent loops follow.

## Success Criteria
- ✓ `grep -r 'TOKEN=' .claude/skills/outlook-auth/ .claude/skills/outlook-base/` = 0 matches
- ✓ `grep -r 'outlook-mcp-tokens.json' .claude/skills/outlook-auth/ .claude/skills/outlook-base/` = 0
- ✓ `grep -r 'node scripts/outlook-auth-server' .claude/skills/outlook-auth/` = 0
- ✓ `grep 'graph_call.py' .claude/skills/outlook-base/SKILL.md` returns ≥1 match
- ✓ `grep 'Never attempt to read tokens' .claude/skills/outlook-base/SKILL.md` returns ≥1 match

## Skills Required

### Broad (from phase plan):
- `markdown-editing`: Systematic find-and-replace across markdown files

### Specific (refined for this loop):
- `outlook-auth`: Reference for auth operation descriptions
- `outlook-base`: Reference for base pattern structure

## Inputs
| Input | Source | Format |
|-------|--------|--------|
| Auth skill (current) | `.claude/skills/outlook-auth/` | Markdown |
| Base skill (current) | `.claude/skills/outlook-base/` | Markdown |
| New proxy interface | `scripts/graph_call.py` | Python (read for CLI spec) |

## Outputs
| Output | Location | Format |
|--------|----------|--------|
| Rewritten auth skill | `.claude/skills/outlook-auth/SKILL.md` + `reference.md` | Markdown |
| Rewritten base skill | `.claude/skills/outlook-base/SKILL.md` + `reference.md` | Markdown |

## Dependencies
### Must Complete Before
- Phase 2 (ralph-loop-200, 201): `scripts/graph_call.py` must exist

## Complexity
**Scope**: Medium — 4 files to rewrite; auth is a full rewrite, base requires careful template replacement
**Key challenges**:
1. Translating curl template blocks to graph_call.py equivalents faithfully
2. Updating response parsing to note the `.data` extraction step

---
---
loop: ralph-loop-301
name: Migrate Email Skills
task_name: Migrate Email Skills (x7)
max_iterations: 8
on_max_iterations: escalate
handoff_summary:
  done: "Migrated all 7 outlook-email-* SKILL.md files to graph_call.py; removed TOKEN blocks; preserved SAFETY confirmation blocks in send/reply/delete/move; updated response parsing to use .data field."
  failed: ""
  needed: "Loop 302 should migrate 4 calendar skills and 2 contacts skills; calendar-list needs --header for Prefer timezone."
todos:
  - id: "301-1"
    content: "Migrate outlook-email-list/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl GET with 'python3 scripts/graph_call.py GET \"/me/messages?...\"', update response parsing to use .data field from proxy output; preserve all parameter docs and frontmatter"
    skill: "outlook-email-list"
    agent: "worker"
    outcome: "outlook-email-list/SKILL.md contains python3 scripts/graph_call.py GET pattern and no TOKEN=$(...) or curl -H Authorization lines"
    status: completed
    priority: high
  - id: "301-2"
    content: "Migrate outlook-email-read/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl GET with 'python3 scripts/graph_call.py GET \"/me/messages/{id}\"', update response parsing to use .data; preserve frontmatter and attachment handling docs"
    skill: "outlook-email-read"
    agent: "worker"
    outcome: "outlook-email-read/SKILL.md contains graph_call.py GET pattern and zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "301-3"
    content: "Migrate outlook-email-send/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl POST with 'python3 scripts/graph_call.py POST \"/me/sendMail\" body_json', update response parsing; critically: preserve the SAFETY confirmation block requiring explicit user approval before sending"
    skill: "outlook-email-send"
    agent: "worker"
    outcome: "outlook-email-send/SKILL.md contains graph_call.py POST pattern; SAFETY confirmation block is intact and unchanged; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "301-4"
    content: "Migrate outlook-email-reply/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl POST with 'python3 scripts/graph_call.py POST \"/me/messages/{id}/reply\"' or replyAll, update response parsing; preserve SAFETY confirmation"
    skill: "outlook-email-reply"
    agent: "worker"
    outcome: "outlook-email-reply/SKILL.md contains graph_call.py POST pattern; SAFETY block preserved; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "301-5"
    content: "Migrate outlook-email-move/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl POST with 'python3 scripts/graph_call.py POST \"/me/messages/{id}/move\" body_json', update response parsing; preserve SAFETY confirmation if present"
    skill: "outlook-email-move"
    agent: "worker"
    outcome: "outlook-email-move/SKILL.md contains graph_call.py POST pattern; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "301-6"
    content: "Migrate outlook-email-delete/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl DELETE with 'python3 scripts/graph_call.py DELETE \"/me/messages/{id}\"', update response parsing (204 returns {\"status\":204,\"data\":null}); preserve SAFETY confirmation"
    skill: "outlook-email-delete"
    agent: "worker"
    outcome: "outlook-email-delete/SKILL.md contains graph_call.py DELETE pattern; 204 no-content handling noted; SAFETY block preserved; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "301-7"
    content: "Migrate outlook-email-organize/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl PATCH with 'python3 scripts/graph_call.py PATCH \"/me/messages/{id}\" body_json', update response parsing; preserve frontmatter and category/flag docs"
    skill: "outlook-email-organize"
    agent: "worker"
    outcome: "outlook-email-organize/SKILL.md contains graph_call.py PATCH pattern; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "301-8"
    content: "Verify all 7 email skills: grep -r 'TOKEN=' .claude/skills/outlook-email-*/ returns zero matches; grep -r 'outlook-mcp-tokens.json' same returns zero; grep -r 'graph_call.py' .claude/skills/outlook-email-*/ returns 7 matches (one per skill); check any email reference.md files for TOKEN patterns"
    skill: "NA"
    agent: "worker"
    outcome: "Zero TOKEN=, zero outlook-mcp-tokens.json references across all 7 email SKILL.md files; grep graph_call.py returns matches in all 7"
    status: completed
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Migrate all 7 outlook-email-* SKILL.md files from TOKEN/curl patterns to python3 scripts/graph_call.py, preserving all SAFETY confirmation blocks and parameter documentation.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-301"

  ## Success criteria
  - [ ] All 7 email SKILL.md files updated: TOKEN=$(...) removed, curl replaced with graph_call.py
  - [ ] SAFETY confirmation blocks preserved in send, reply, delete, move
  - [ ] Response parsing updated to use .data field from {"status": N, "data": {...}}
  - [ ] grep -r 'TOKEN=' .claude/skills/outlook-email-*/ = 0 matches
  - [ ] grep -r 'graph_call.py' .claude/skills/outlook-email-*/ = 7 matches

  ## Required skills
  - Read each skill before editing — do not edit blindly
  - Preserve YAML frontmatter (name, description, user_invocable) exactly as-is

  ## graph_call.py interface (reference)
  python3 scripts/graph_call.py METHOD "/endpoint" ['{"json":"body"}'] [--header "Key: Value"]
  Output: {"status": N, "data": {...}} or {"status": N, "error": "...", "message": "..."}
  Parse response: extract the .data field for successful calls

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-301 — 7 email skills migrated to graph_call.py"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 301 migrates all 7 email operation skills from the old TOKEN/curl pattern to `graph_call.py`. The change is mechanical per skill: remove the TOKEN block, replace curl with `python3 scripts/graph_call.py METHOD "/endpoint"`, update response parsing to extract `.data`. SAFETY confirmation blocks in send/reply/delete/move must be preserved exactly.

## Success Criteria
- ✓ `grep -r 'TOKEN=' .claude/skills/outlook-email-*/` = 0 matches
- ✓ `grep -r 'curl.*Authorization.*Bearer' .claude/skills/outlook-email-*/` = 0 matches
- ✓ `grep -r 'graph_call.py' .claude/skills/outlook-email-*/` = 7 matches (one per skill)
- ✓ SAFETY blocks intact in email-send, email-reply, email-delete, email-move

## Skills Required

### Broad (from phase plan):
- `markdown-editing`: Systematic find-and-replace

### Specific (refined for this loop):
- `outlook-email-list`, `outlook-email-read`, `outlook-email-send`, `outlook-email-reply`, `outlook-email-move`, `outlook-email-delete`, `outlook-email-organize`

## Dependencies
### Must Complete Before
- ralph-loop-300: outlook-base/SKILL.md must be migrated first to establish the reference pattern

## Complexity
**Scope**: Medium — 7 files, same mechanical change each time
**Key challenges**:
1. Preserving SAFETY confirmation blocks without accidentally truncating them
2. Updating response parsing in each skill (raw JSON → extract `.data`)

---
---
loop: ralph-loop-302
name: Migrate Calendar and Contacts Skills
task_name: Migrate Calendar and Contacts Skills (x6)
max_iterations: 8
on_max_iterations: escalate
handoff_summary:
  done: "Migrated 4 calendar and 2 contacts SKILL.md files to graph_call.py; calendar-list uses --header for Prefer timezone; SAFETY blocks preserved in calendar-create, update, and respond (cancel)."
  failed: ""
  needed: "Loop 303 should migrate outlook-folders, outlook-rules, outlook-categories, scan reference.md files, and run the full Phase 3 verification grep suite."
todos:
  - id: "302-1"
    content: "Migrate outlook-calendar-list/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl GET (with -H 'Prefer: outlook.timezone=...' header) with 'python3 scripts/graph_call.py GET \"/me/calendarView?...\" --header \"Prefer: outlook.timezone=\\\"UTC\\\"\"'; update response parsing to use .data; preserve frontmatter"
    skill: "outlook-calendar-list"
    agent: "worker"
    outcome: "outlook-calendar-list/SKILL.md contains graph_call.py GET pattern with --header flag for timezone Prefer header; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "302-2"
    content: "Migrate outlook-calendar-create/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl POST with 'python3 scripts/graph_call.py POST \"/me/events\" body_json'; preserve SAFETY confirmation block; update response parsing to use .data; preserve frontmatter and recurrence docs"
    skill: "outlook-calendar-create"
    agent: "worker"
    outcome: "outlook-calendar-create/SKILL.md contains graph_call.py POST pattern; SAFETY block preserved; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "302-3"
    content: "Migrate outlook-calendar-update/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl PATCH with 'python3 scripts/graph_call.py PATCH \"/me/events/{id}\" body_json'; preserve SAFETY confirmation block; update response parsing; preserve frontmatter"
    skill: "outlook-calendar-update"
    agent: "worker"
    outcome: "outlook-calendar-update/SKILL.md contains graph_call.py PATCH pattern; SAFETY block preserved; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "302-4"
    content: "Migrate outlook-calendar-respond/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl POST (accept/decline/tentativelyAccept/cancel) with 'python3 scripts/graph_call.py POST \"/me/events/{id}/accept\"' etc.; preserve SAFETY confirmation block; update response parsing; preserve frontmatter"
    skill: "outlook-calendar-respond"
    agent: "worker"
    outcome: "outlook-calendar-respond/SKILL.md contains graph_call.py POST pattern for all response types; SAFETY block preserved; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "302-5"
    content: "Migrate outlook-contacts-list/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl GET with 'python3 scripts/graph_call.py GET \"/me/contacts?...\"'; update response parsing to use .data; preserve frontmatter and search docs"
    skill: "outlook-contacts-list"
    agent: "worker"
    outcome: "outlook-contacts-list/SKILL.md contains graph_call.py GET pattern; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "302-6"
    content: "Migrate outlook-contacts-manage/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl POST/PATCH with 'python3 scripts/graph_call.py POST \"/me/contacts\" body_json' and 'python3 scripts/graph_call.py PATCH \"/me/contacts/{id}\" body_json'; update response parsing; preserve frontmatter"
    skill: "outlook-contacts-manage"
    agent: "worker"
    outcome: "outlook-contacts-manage/SKILL.md contains graph_call.py POST and PATCH patterns; zero TOKEN or curl Authorization patterns"
    status: completed
    priority: high
  - id: "302-7"
    content: "Verify all 6 calendar and contacts skills: grep -r 'TOKEN=' .claude/skills/outlook-calendar-*/ .claude/skills/outlook-contacts-*/ returns zero; grep -r 'outlook-mcp-tokens.json' same returns zero; grep -r 'graph_call.py' same returns 6 matches; check any reference.md files in these dirs for TOKEN patterns"
    skill: "NA"
    agent: "worker"
    outcome: "Zero TOKEN=, zero outlook-mcp-tokens.json across all 6 calendar+contacts skills; graph_call.py appears in all 6 SKILL.md files"
    status: completed
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Migrate all 4 outlook-calendar-* and 2 outlook-contacts-* SKILL.md files from TOKEN/curl to graph_call.py, with special attention to the calendar Prefer timezone header.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-302"

  ## Success criteria
  - [ ] All 6 skills updated: TOKEN=$(...) removed, curl replaced with graph_call.py
  - [ ] Calendar-list uses --header flag for timezone: --header "Prefer: outlook.timezone=\"UTC\""
  - [ ] SAFETY blocks preserved in calendar-create, calendar-update, calendar-respond
  - [ ] grep -r 'TOKEN=' .claude/skills/outlook-calendar-*/ .claude/skills/outlook-contacts-*/ = 0
  - [ ] grep -r 'graph_call.py' same dirs = 6 matches

  ## Special note for calendar-list
  The calendar list skill uses a Prefer: outlook.timezone header. Translate:
    curl -H "Prefer: outlook.timezone=\"UTC\""
  to:
    python3 scripts/graph_call.py GET "/me/calendarView?..." --header "Prefer: outlook.timezone=\"UTC\""

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-302 — 6 calendar+contacts skills migrated to graph_call.py"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 302 migrates 4 calendar and 2 contacts skills. The calendar skills require extra care: `calendar-list` uses a timezone `Prefer` header that must be translated to `--header` flag syntax. All three calendar mutation skills (create/update/respond) have SAFETY confirmation blocks that must be preserved.

## Success Criteria
- ✓ `grep -r 'TOKEN=' .claude/skills/outlook-calendar-*/ .claude/skills/outlook-contacts-*/` = 0
- ✓ `grep -r 'graph_call.py' .claude/skills/outlook-calendar-*/ .claude/skills/outlook-contacts-*/` = 6
- ✓ `grep '\-\-header' .claude/skills/outlook-calendar-list/SKILL.md` shows Prefer timezone header
- ✓ SAFETY blocks intact in calendar-create, calendar-update, calendar-respond

## Skills Required

### Specific (refined for this loop):
- `outlook-calendar-list`, `outlook-calendar-create`, `outlook-calendar-update`, `outlook-calendar-respond`
- `outlook-contacts-list`, `outlook-contacts-manage`

## Dependencies
### Must Complete Before
- ralph-loop-300: base pattern established

## Complexity
**Scope**: Medium
**Key challenges**:
1. Timezone header translation: `-H "Prefer: ..."` → `--header "Prefer: ..."`
2. Preserving SAFETY blocks in 3 calendar mutation skills

---
---
loop: ralph-loop-303
name: Migrate Folders Rules Categories and Verify
task_name: Migrate Folders Rules Categories and Full Verification
max_iterations: 8
on_max_iterations: escalate
handoff_summary:
  done: ""
  failed: ""
  needed: ""
todos:
  - id: "303-1"
    content: "Migrate outlook-folders/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl GET/POST with graph_call.py equivalents; preserve SAFETY confirmation block for folder creation/move operations; update response parsing to use .data; preserve frontmatter"
    skill: "outlook-folders"
    agent: "worker"
    outcome: "outlook-folders/SKILL.md contains graph_call.py patterns for all operations; SAFETY block preserved; zero TOKEN or curl Authorization patterns"
    status: pending
    priority: high
  - id: "303-2"
    content: "Migrate outlook-rules/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl GET/POST/PATCH with graph_call.py equivalents; preserve SAFETY confirmation block for rule creation; update response parsing to use .data; preserve frontmatter and rule parameter docs"
    skill: "outlook-rules"
    agent: "worker"
    outcome: "outlook-rules/SKILL.md contains graph_call.py patterns; SAFETY block preserved; zero TOKEN or curl Authorization patterns"
    status: pending
    priority: high
  - id: "303-3"
    content: "Migrate outlook-categories/SKILL.md: read current file, remove TOKEN=$(...) block, replace curl GET with 'python3 scripts/graph_call.py GET \"/me/outlook/masterCategories\"'; update response parsing to use .data; preserve frontmatter"
    skill: "outlook-categories"
    agent: "worker"
    outcome: "outlook-categories/SKILL.md contains graph_call.py GET pattern; zero TOKEN or curl Authorization patterns"
    status: pending
    priority: high
  - id: "303-4"
    content: "Scan all reference.md files across all skill directories for remaining $TOKEN or 'curl -H \"Authorization: Bearer' patterns and update any found: grep -r 'Authorization: Bearer' .claude/skills/ and grep -r 'outlook-mcp-tokens.json' .claude/skills/"
    skill: "NA"
    agent: "worker"
    outcome: "grep -r 'Authorization: Bearer' .claude/skills/ returns zero matches; grep -r 'outlook-mcp-tokens.json' .claude/skills/ returns zero matches"
    status: pending
    priority: high
  - id: "303-5"
    content: "Full verification scan — run all Phase 3 success criteria grep commands: (1) grep -r '$TOKEN' .claude/skills/ = 0, (2) grep -r 'outlook-mcp-tokens.json' .claude/skills/ = 0, (3) grep -r 'node scripts/outlook-auth-server' .claude/skills/ = 0, (4) grep -r 'node scripts/outlook-token-refresh' .claude/skills/ = 0, (5) grep -r 'TOKEN=\\$(' .claude/skills/ = 0"
    skill: "NA"
    agent: "worker"
    outcome: "All 5 grep scans return zero matches — no legacy token patterns survive in any skill file"
    status: pending
    priority: high
  - id: "303-6"
    content: "Verify graph_call.py is present in all 16 operation skills: grep -r 'graph_call.py' .claude/skills/outlook-email-*/ .claude/skills/outlook-calendar-*/ .claude/skills/outlook-contacts-*/ .claude/skills/outlook-folders/ .claude/skills/outlook-rules/ .claude/skills/outlook-categories/ — should return at least 16 matches"
    skill: "NA"
    agent: "worker"
    outcome: "grep -r 'graph_call.py' across all 16 operation skill directories returns at least 16 matches"
    status: pending
    priority: high
  - id: "303-7"
    content: "Run npm run test:static from the project root and confirm it passes — this validates SKILL.md frontmatter structure is still correct after all migration edits"
    skill: "NA"
    agent: "worker"
    outcome: "npm run test:static exits 0 with no failures reported"
    status: pending
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Migrate the final 3 skills (folders, rules, categories), scan and fix any remaining TOKEN patterns in reference.md files, run the full Phase 3 verification grep suite, and confirm npm run test:static passes.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-303"

  ## Success criteria
  - [ ] outlook-folders, outlook-rules, outlook-categories migrated to graph_call.py
  - [ ] All reference.md files scanned — zero 'Authorization: Bearer' or 'outlook-mcp-tokens.json' patterns
  - [ ] grep -r '$TOKEN' .claude/skills/ = 0
  - [ ] grep -r 'outlook-mcp-tokens.json' .claude/skills/ = 0
  - [ ] grep -r 'node scripts/outlook-auth-server' .claude/skills/ = 0
  - [ ] grep -r 'node scripts/outlook-token-refresh' .claude/skills/ = 0
  - [ ] grep -r 'TOKEN=$(' .claude/skills/ = 0
  - [ ] grep -r 'graph_call.py' across all 16 operation skills = ≥16 matches
  - [ ] npm run test:static exits 0

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-303 — Phase 3 migration complete, all skills use graph_call.py"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 303 completes the Phase 3 migration by handling the remaining 3 operation skills (folders/rules/categories), scanning all reference.md files for any surviving TOKEN patterns, and running the full Phase 3 verification suite. The `npm run test:static` check at the end validates that YAML frontmatter structure is intact across all skills after the migration edits.

## Success Criteria
- ✓ All 5 Phase 3 grep verification scans return 0 matches
- ✓ `grep -r 'graph_call.py'` across all 16 operation skills returns ≥16 matches
- ✓ `npm run test:static` exits 0

## Skills Required

### Specific (refined for this loop):
- `outlook-folders`, `outlook-rules`, `outlook-categories`

## Dependencies
### Must Complete Before
- ralph-loop-302: all prior skills migrated

## Complexity
**Scope**: Low for migrations (3 files), High for verification (comprehensive scan)
**Key challenges**:
1. Catching any TOKEN patterns that slipped through in reference.md files not covered by prior loops
2. Ensuring npm test:static passes — frontmatter must be unchanged
