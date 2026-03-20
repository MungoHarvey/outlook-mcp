---
loop: ralph-loop-600
name: Create references/ subdirs and copy YAML files
task_name: Create per-skill references/ subdirectories with YAML files
max_iterations: 6
on_max_iterations: escalate
handoff_summary:
  done: ""
  failed: ""
  needed: "Loop 601 should update all ../outlook-references/ path references in skill files, add params.yaml to calendar-update, and fix templates.md."
todos:
  - id: "600-1"
    content: "Create .claude/skills/outlook-base/references/ and copy all 4 YAML files from .claude/skills/outlook-references/ into it: errors.yaml, timezones.yaml, colors.yaml, graph-api-patterns.yaml"
    skill: "outlook-base"
    agent: "worker"
    outcome: ".claude/skills/outlook-base/references/ exists and contains errors.yaml, timezones.yaml, colors.yaml, graph-api-patterns.yaml"
    status: pending
    priority: high
  - id: "600-2"
    content: "Create references/ subdirs for 7 email skills and copy needed YAML files: outlook-email-list (errors.yaml, graph-api-patterns.yaml), outlook-email-read (errors.yaml, graph-api-patterns.yaml), outlook-email-send (errors.yaml, graph-api-patterns.yaml), outlook-email-reply (errors.yaml), outlook-email-move (errors.yaml, graph-api-patterns.yaml), outlook-email-delete (errors.yaml, graph-api-patterns.yaml), outlook-email-organize (colors.yaml, errors.yaml, graph-api-patterns.yaml)"
    skill: "NA"
    agent: "worker"
    outcome: "All 7 email skill folders have references/ subdirs with exactly the listed YAML files"
    status: pending
    priority: high
  - id: "600-3"
    content: "Create references/ subdirs for 4 calendar skills and copy needed YAML files: outlook-calendar-list (timezones.yaml, errors.yaml, graph-api-patterns.yaml), outlook-calendar-create (timezones.yaml, colors.yaml, errors.yaml), outlook-calendar-update (timezones.yaml, errors.yaml), outlook-calendar-respond (errors.yaml)"
    skill: "NA"
    agent: "worker"
    outcome: "All 4 calendar skill folders have references/ subdirs with exactly the listed YAML files"
    status: pending
    priority: high
  - id: "600-4"
    content: "Create references/ subdirs for remaining skills: outlook-contacts-list (errors.yaml), outlook-contacts-manage (errors.yaml), outlook-rules (errors.yaml), outlook-categories (colors.yaml). Note: outlook-auth and outlook-folders get NO references/ dir — they reference no YAML data files."
    skill: "NA"
    agent: "worker"
    outcome: "outlook-contacts-list, outlook-contacts-manage, outlook-rules, outlook-categories each have references/ subdirs with the listed files; outlook-auth and outlook-folders have no references/ dir"
    status: pending
    priority: high
  - id: "600-5"
    content: "Verify all references/ subdirs: for each skill that should have one, confirm the directory and files exist. Run: find .claude/skills -name 'references' -type d to list all created dirs. Confirm count = 16. Confirm no outlook-auth/references/ or outlook-folders/references/ exist."
    skill: "NA"
    agent: "worker"
    outcome: "find returns exactly 16 references/ directories; no references/ under outlook-auth or outlook-folders"
    status: pending
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Create a `references/` subdirectory inside each skill that needs YAML data files, and copy only the files that skill actually uses. This makes each skill self-contained — no more dependency on the shared outlook-references/ sibling directory.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-600"

  ## YAML source files (copy FROM here)
  .claude/skills/outlook-references/errors.yaml
  .claude/skills/outlook-references/timezones.yaml
  .claude/skills/outlook-references/colors.yaml
  .claude/skills/outlook-references/graph-api-patterns.yaml

  ## Per-skill mapping — copy ONLY the listed files
  | Skill | Files to copy |
  |---|---|
  | outlook-base | errors.yaml, timezones.yaml, colors.yaml, graph-api-patterns.yaml |
  | outlook-email-list | errors.yaml, graph-api-patterns.yaml |
  | outlook-email-read | errors.yaml, graph-api-patterns.yaml |
  | outlook-email-send | errors.yaml, graph-api-patterns.yaml |
  | outlook-email-reply | errors.yaml |
  | outlook-email-move | errors.yaml, graph-api-patterns.yaml |
  | outlook-email-delete | errors.yaml, graph-api-patterns.yaml |
  | outlook-email-organize | colors.yaml, errors.yaml, graph-api-patterns.yaml |
  | outlook-calendar-list | timezones.yaml, errors.yaml, graph-api-patterns.yaml |
  | outlook-calendar-create | timezones.yaml, colors.yaml, errors.yaml |
  | outlook-calendar-update | timezones.yaml, errors.yaml |
  | outlook-calendar-respond | errors.yaml |
  | outlook-contacts-list | errors.yaml |
  | outlook-contacts-manage | errors.yaml |
  | outlook-rules | errors.yaml |
  | outlook-categories | colors.yaml |

  ## Skills with NO references/ dir
  - outlook-auth — references no YAML data files
  - outlook-folders — references no YAML data files

  ## Success criteria
  - [ ] 16 references/ subdirectories created (find .claude/skills -name 'references' -type d | wc -l = 16)
  - [ ] Each dir contains only the files listed for that skill (no extras)
  - [ ] No references/ dir under outlook-auth or outlook-folders
  - [ ] YAML file contents are identical copies of the originals (do not modify content)

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-600 — per-skill references/ subdirs created"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 600 creates the `references/` subdirectory structure inside each skill folder and populates it with only the YAML files that skill actually links to. The files are copied verbatim from the shared `outlook-references/` directory — content is not changed, only location. The shared directory is NOT deleted yet (that is loop 602's job).

## Success Criteria
- ✓ `find .claude/skills -name 'references' -type d | wc -l` = 16
- ✓ No `outlook-auth/references/` or `outlook-folders/references/` directories
- ✓ Each skill's `references/` contains exactly the YAML files it needs (no extras, none missing)

---
---
loop: ralph-loop-601
name: Update path refs, add calendar-update params, fix templates.md
task_name: Update ../outlook-references/ paths, add params.yaml, fix templates.md
max_iterations: 8
on_max_iterations: escalate
handoff_summary:
  done: ""
  failed: ""
  needed: "Loop 602 should delete outlook-references/, update package scripts, update docs, and run full verification."
todos:
  - id: "601-1"
    content: "Update outlook-base/reference.md: replace all 7 occurrences of '../outlook-references/' with 'references/' — lines 90, 99, 109, 126, 127, 128, 129, 130. Also update the section header text on line 126 from 'YAML files in [outlook-references](../outlook-references/)' to 'YAML files in [references/](references/)'"
    skill: "outlook-base"
    agent: "worker"
    outcome: "outlook-base/reference.md contains zero occurrences of '../outlook-references/'; all 7 replaced links now point to 'references/X.yaml'"
    status: pending
    priority: high
  - id: "601-2"
    content: "Update outlook-calendar-create/SKILL.md lines 29 and 39: replace '../outlook-references/timezones.yaml' with 'references/timezones.yaml' and '../outlook-references/colors.yaml' with 'references/colors.yaml'"
    skill: "outlook-calendar-create"
    agent: "worker"
    outcome: "outlook-calendar-create/SKILL.md has zero '../outlook-references/' occurrences; both links point to references/"
    status: pending
    priority: high
  - id: "601-3"
    content: "Update outlook-calendar-update/SKILL.md: (a) line 37 — change '../outlook-calendar-create/params.yaml' to 'params.yaml'; (b) line 39 — change '../outlook-references/timezones.yaml' to 'references/timezones.yaml'"
    skill: "outlook-calendar-update"
    agent: "worker"
    outcome: "outlook-calendar-update/SKILL.md references 'params.yaml' (local) not '../outlook-calendar-create/params.yaml'; references 'references/timezones.yaml' not '../outlook-references/timezones.yaml'"
    status: pending
    priority: high
  - id: "601-4"
    content: "Copy .claude/skills/outlook-calendar-create/params.yaml to .claude/skills/outlook-calendar-update/params.yaml (same parameters apply to update operations)"
    skill: "outlook-calendar-update"
    agent: "worker"
    outcome: ".claude/skills/outlook-calendar-update/params.yaml exists with same content as outlook-calendar-create/params.yaml"
    status: pending
    priority: high
  - id: "601-5"
    content: "Update outlook-categories/SKILL.md line 35: replace '../outlook-references/colors.yaml' with 'references/colors.yaml'"
    skill: "outlook-categories"
    agent: "worker"
    outcome: "outlook-categories/SKILL.md has zero '../outlook-references/' occurrences"
    status: pending
    priority: high
  - id: "601-6"
    content: "Update all remaining reference.md files that contain '../outlook-references/': outlook-email-list/reference.md (line 63), outlook-email-organize/reference.md (lines 38, 52), outlook-calendar-create/reference.md (line 107), outlook-calendar-update/reference.md (line 62), outlook-rules/reference.md (line 50). Also scan and update: outlook-email-read, outlook-email-send, outlook-email-reply, outlook-email-move, outlook-email-delete, outlook-calendar-list, outlook-calendar-respond, outlook-contacts-list, outlook-contacts-manage reference.md files."
    skill: "NA"
    agent: "worker"
    outcome: "grep -r '../outlook-references/' .claude/skills/ returns zero matches"
    status: pending
    priority: high
  - id: "601-7"
    content: "Fix outlook-rules/templates.md: replace all 3 curl command blocks with graph_call.py equivalents. Each template uses: curl -s -X POST -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json' -d '{...}' 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules'. Replace with: python3 scripts/graph_call.py POST '/me/mailFolders/inbox/messageRules' '{...}'. Apply to all 3 templates."
    skill: "outlook-rules"
    agent: "worker"
    outcome: "outlook-rules/templates.md contains zero 'curl', 'Bearer', or '$TOKEN' occurrences; all 3 templates use python3 scripts/graph_call.py POST"
    status: pending
    priority: high
  - id: "601-8"
    content: "Verify loop 601: (1) grep -r '../outlook-references/' .claude/skills/ = 0 matches; (2) grep 'curl' .claude/skills/outlook-rules/templates.md = 0 matches; (3) grep 'Bearer' .claude/skills/outlook-rules/templates.md = 0 matches; (4) ls .claude/skills/outlook-calendar-update/params.yaml confirms file exists"
    skill: "NA"
    agent: "worker"
    outcome: "All 4 verification checks pass: zero '../outlook-references/' paths, zero curl/Bearer in templates.md, params.yaml exists for calendar-update"
    status: pending
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Update all skill files to use local `references/X.yaml` paths instead of `../outlook-references/X.yaml`,
  add a local params.yaml to outlook-calendar-update, and fix the curl/Bearer issue in templates.md.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-601"

  ## Path change rule
  Every occurrence of `../outlook-references/X.yaml` → `references/X.yaml`
  Every occurrence of `../outlook-references/` → `references/`

  ## Files with confirmed path occurrences (read each before editing)
  - outlook-base/reference.md — lines 90, 99, 109, 126–130 (7 occurrences)
  - outlook-calendar-create/SKILL.md — lines 29, 39
  - outlook-calendar-create/reference.md — line 107
  - outlook-calendar-update/SKILL.md — lines 37 (cross-skill ref), 39 (timezones ref)
  - outlook-calendar-update/reference.md — line 62
  - outlook-categories/SKILL.md — line 35
  - outlook-rules/reference.md — line 50
  - outlook-email-list/reference.md — line 63
  - outlook-email-organize/reference.md — lines 38, 52
  - Also scan: all other email/calendar/contacts reference.md files

  ## templates.md fix
  outlook-rules/templates.md has 3 curl templates. Replace pattern:
    curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d '{JSON_BODY}' "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules"
  With:
    python3 scripts/graph_call.py POST "/me/mailFolders/inbox/messageRules" '{JSON_BODY}'

  Keep all JSON body content identical. Keep all surrounding markdown unchanged.

  ## params.yaml for calendar-update
  Copy .claude/skills/outlook-calendar-create/params.yaml to .claude/skills/outlook-calendar-update/params.yaml
  Update the reference in outlook-calendar-update/SKILL.md line 37 from:
    [calendar-create params](../outlook-calendar-create/params.yaml)
  to:
    [params.yaml](params.yaml)

  ## Success criteria
  - [ ] grep -r '../outlook-references/' .claude/skills/ = 0 matches
  - [ ] grep 'curl' .claude/skills/outlook-rules/templates.md = 0
  - [ ] grep 'Bearer' .claude/skills/outlook-rules/templates.md = 0
  - [ ] .claude/skills/outlook-calendar-update/params.yaml exists

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-601 — path refs updated, params.yaml added, templates.md fixed"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 601 is the path-update pass. Every `../outlook-references/X.yaml` reference in every skill file gets replaced with the local `references/X.yaml` path. Additionally: `outlook-calendar-update` gets its own `params.yaml`, and `outlook-rules/templates.md` gets its legacy curl commands replaced with `graph_call.py`.

## Success Criteria
- ✓ `grep -r '../outlook-references/' .claude/skills/` = 0 matches
- ✓ `grep 'curl\|Bearer\|\$TOKEN' .claude/skills/outlook-rules/templates.md` = 0 matches
- ✓ `.claude/skills/outlook-calendar-update/params.yaml` exists

---
---
loop: ralph-loop-602
name: Delete outlook-references/, update package scripts and docs, verify
task_name: Cleanup, package script updates, docs, and full verification
max_iterations: 6
on_max_iterations: escalate
handoff_summary:
  done: ""
  failed: ""
  needed: ""
todos:
  - id: "602-1"
    content: "Delete the shared .claude/skills/outlook-references/ directory entirely (rm -rf .claude/skills/outlook-references/). All data is now in per-skill references/ subdirs."
    skill: "NA"
    agent: "worker"
    outcome: ".claude/skills/outlook-references/ directory does not exist; ls .claude/skills/ shows no outlook-references entry"
    status: pending
    priority: high
  - id: "602-2"
    content: "Update setup/package.sh: (1) remove the 'VERSION=$(date +%Y%m%d)' line, (2) change 'PKG_NAME=outlook-skills-$VERSION' to 'PKG_NAME=outlook-skills', (3) remove the 3-line outlook-references copy block (mkdir -p + cp -r of outlook-references), (4) update comment header from 'outlook-skills-YYYYMMDD/' to 'outlook-skills/'"
    skill: "NA"
    agent: "worker"
    outcome: "setup/package.sh produces 'outlook-skills' as PKG_NAME with no date; contains no outlook-references copy block; comment header shows 'outlook-skills/'"
    status: pending
    priority: high
  - id: "602-3"
    content: "Update setup/package.ps1: (1) remove '$Version = Get-Date -Format yyyyMMdd' line, (2) change '$PkgName = outlook-skills-$Version' to '$PkgName = outlook-skills', (3) remove the outlook-references copy block ($refDest lines), (4) update comment header from 'outlook-skills-YYYYMMDD/' to 'outlook-skills/'"
    skill: "NA"
    agent: "worker"
    outcome: "setup/package.ps1 produces 'outlook-skills' as PkgName with no date; contains no outlook-references copy block"
    status: pending
    priority: high
  - id: "602-4"
    content: "Update README.md: (1) change 'outlook-skills-YYYYMMDD.zip' to 'outlook-skills.zip' in all occurrences; (2) in the Project Structure section, remove the outlook-references/ entries and add a note that each skill carries its own references/ subdir with the YAML files it needs"
    skill: "NA"
    agent: "worker"
    outcome: "README.md contains zero 'outlook-skills-YYYYMMDD' occurrences; project structure section mentions per-skill references/ subdirs"
    status: pending
    priority: high
  - id: "602-5"
    content: "Update CLAUDE.md: (1) remove any 'outlook-references/' directory entries; (2) add a note in Skill File Conventions that skills carry YAML reference data in a references/ subdir"
    skill: "NA"
    agent: "worker"
    outcome: "CLAUDE.md contains no 'outlook-references' directory entry; mentions references/ subdir convention"
    status: pending
    priority: high
  - id: "602-6"
    content: "Update setup/SKILLS.md: remove the 'Shared data' table listing timezones.yaml, colors.yaml, errors.yaml, graph-api-patterns.yaml as shared files. Replace with: 'Each skill carries its own reference data in a references/ subdirectory — only the files it actually uses.'"
    skill: "NA"
    agent: "worker"
    outcome: "setup/SKILLS.md contains no 'outlook-references' references; has a note about per-skill references/ subdirs"
    status: pending
    priority: high
  - id: "602-7"
    content: "Run full verification: (1) npm run test:static — must pass; (2) grep -r '../outlook-references/' .claude/skills/ = 0; (3) ls .claude/skills/outlook-references/ should fail (directory absent); (4) find .claude/skills -name 'references' -type d | wc -l = 16; (5) grep -r 'curl' .claude/skills/outlook-rules/templates.md = 0; (6) ls .claude/skills/outlook-calendar-update/params.yaml = exists; (7) npm test — must pass"
    skill: "NA"
    agent: "worker"
    outcome: "All 7 verification checks pass: test:static passes, zero ../outlook-references/ refs, outlook-references/ deleted, 16 references/ dirs, no curl in templates.md, calendar-update params.yaml exists, npm test passes"
    status: pending
    priority: high
  - id: "602-8"
    content: "Commit final state: git add -A && git commit -m 'feat: self-contained skills with per-skill references/ subdirs and undated zip'"
    skill: "NA"
    agent: "worker"
    outcome: "Git commit created with all Phase 6 changes"
    status: pending
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Delete the now-redundant shared outlook-references/ directory, update both package scripts to produce
  an undated outlook-skills.zip, update documentation, and run full Phase 6 verification.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-602"

  ## Tasks

  ### 1. Delete outlook-references/
  rm -rf .claude/skills/outlook-references/

  ### 2. setup/package.sh changes
  - Remove: VERSION="$(date +%Y%m%d)"
  - Change: PKG_NAME="outlook-skills-$VERSION" → PKG_NAME="outlook-skills"
  - Remove the 3 lines: mkdir -p "$PKG_DIR/outlook-references" + cp -r "...outlook-references/." "$PKG_DIR/outlook-references/"
  - Update comment header: "outlook-skills-YYYYMMDD/" → "outlook-skills/"

  ### 3. setup/package.ps1 changes
  - Remove: $Version = Get-Date -Format "yyyyMMdd"
  - Change: $PkgName = "outlook-skills-$Version" → $PkgName = "outlook-skills"
  - Remove: $refDest block (3 lines)
  - Update comment header

  ### 4. README.md
  - "outlook-skills-YYYYMMDD.zip" → "outlook-skills.zip" (all occurrences)
  - Remove outlook-references/ entries from project structure; add per-skill references/ note

  ### 5. CLAUDE.md
  - Remove outlook-references/ directory entry
  - Add references/ subdir convention note

  ### 6. setup/SKILLS.md
  - Replace shared-data table with per-skill note

  ## Success criteria
  - [ ] .claude/skills/outlook-references/ does not exist
  - [ ] setup/package.sh has no VERSION date, no outlook-references copy block
  - [ ] setup/package.ps1 has no $Version date, no outlook-references copy block
  - [ ] README.md has zero 'outlook-skills-YYYYMMDD' occurrences
  - [ ] npm run test:static exits 0
  - [ ] npm test exits 0
  - [ ] find .claude/skills -name 'references' -type d | wc -l = 16

  ## On completion
  1. git add -A && git commit -m "feat: self-contained skills with per-skill references/ subdirs and undated zip"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 602 is the cleanup and verification pass. The shared `outlook-references/` is deleted. Both package scripts updated to produce `outlook-skills.zip` without date. Documentation updated. Final verification suite confirms everything is clean.

## Success Criteria
- ✓ `.claude/skills/outlook-references/` does not exist
- ✓ `setup/package.sh` produces `outlook-skills` (no date)
- ✓ `grep -r '../outlook-references/' .claude/skills/` = 0
- ✓ `find .claude/skills -name 'references' -type d | wc -l` = 16
- ✓ `npm run test:static` exits 0
- ✓ `npm test` exits 0
