# Phase 3 — Ralph Loops: Skill Content Correctness

Source phase plan: `.advanced-plans/phases/phase-3/plan.md`
On-max recovery for all loops: `escalate`.

---

```yaml
---
name: "ralph-loop-300"
task_name: "curl -> graph_call.py rewrites + .data unwrap templates"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-300-1"
    content: "Rewrite all 17 curl+Bearer examples to graph_call.py calls"
    skill: "NA"
    agent: "NA"
    outcome: "grep -rn 'Bearer' skills/ and grep -rn 'curl ' skills/ return zero matches; each rewritten block uses python graph_call.py METHOD /endpoint with the original JSON body"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-300-2"
    content: "Fix the 8 parsing templates that omit the {status,data} unwrap"
    skill: "NA"
    agent: "NA"
    outcome: "Each affected template reads data = json.load(sys.stdin).get('data', {}) (or ['data']); spot-check of list/read/reply/folders templates against real graph_call output yields intended values, not empty/NOT_FOUND/KeyError"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Eliminate the security-violating curl examples and fix the response-parsing templates so copied snippets actually work.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-300 HEAD

  ## Success criteria
  - [ ] No curl/Bearer anywhere under skills/
  - [ ] 8 unwrap templates corrected; representative ones verified against live proxy output

  ## Required skills
  - None (markdown + graph-api knowledge)

  ## Inputs
  - 7 reference.md with curl blocks; 8 templates (email-list, folders, email-reply, email-read, rules, categories refs)

  ## Expected outputs
  - Rewritten reference.md examples and templates

  ## Constraints
  - Reuse existing valid Graph JSON bodies verbatim in positional-body form
  - Fix content BEFORE Phase 4 dedup so fixes aren't lost on deletion

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
The two highest-runtime-impact content fixes: remove the 17 curl+Bearer snippets (which invite reading tokens.json) and fix the 8 templates that parse the wrapper wrong.

## Success Criteria
- ✓ Zero curl/Bearer under skills/; templates produce real values
## Skills Required
### Broad: `technical-writing`, `graph-api`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: Phase 4 dedup. ### Blocked By: Phase 1/2 (final runtime). ### Parallelisable: loop-310 by file
## Complexity
**Scope**: Medium-High (many files, uniform). **Effort**: 3–4 hours. **Challenge**: verifying templates against real output.

---

```yaml
---
name: "ralph-loop-310"
task_name: "OData escaping + batched correctness fixes"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-310-1"
    content: "Escape OData $ params and encode spaces in all bash examples"
    skill: "NA"
    agent: "NA"
    outcome: "Every graph_call.py example escapes \\$select/\\$top/\\$orderby/\\$filter/\\$search and uses %20 for spaces; no unescaped $ODATA remains inside double quotes (verified by grep)"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-310-2"
    content: "Correct stated success status codes to match Graph"
    skill: "NA"
    agent: "NA"
    outcome: "send/reply/respond say 202, move says 201; no SKILL.md claims 204/200 for these operations"
    status: pending
    complexity: low
    priority: high
  - id: "loop-310-3"
    content: "Fix remaining batched correctness issues"
    skill: "NA"
    agent: "NA"
    outcome: "-H replaced with --header; PowerShell examples use $env:CLAUDE_PLUGIN_ROOT; calendar-list display uses CLAUDE_PLUGIN_ROOT abs path; dangling curl -d fragments become full graph_call.py calls; rules create example includes a valid action"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Make the shell examples shell-safe and the stated behaviors accurate.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-310 HEAD

  ## Success criteria
  - [ ] No unescaped OData $ inside double-quoted examples; spaces encoded
  - [ ] Success codes correct (202/201)
  - [ ] --header, PowerShell $env: var, abs script path, no dangling -d, valid rules example

  ## Required skills
  - None (markdown)

  ## Inputs
  - outlook-base, email-list, folders, calendar-list, email-draft refs; SKILL.md status lines; calendar-update, rules

  ## Expected outputs
  - Corrected examples across skills

  ## Constraints
  - Fix content before Phase 4 dedup

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Escape the OData params bash silently eats and clear the backlog of small correctness bugs (status codes, header flag, PowerShell vars, dangling curl, invalid rules example).

## Success Criteria
- ✓ Shell-safe examples; accurate codes and flags
## Skills Required
### Broad: `technical-writing`, `graph-api`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: Phase 4 dedup. ### Blocked By: nothing in-phase. ### Parallelisable: loop-300 by file
## Complexity
**Scope**: Medium. **Effort**: 2–3 hours. **Challenge**: catching every unescaped `$` across many files.

---

```yaml
---
name: "ralph-loop-320"
task_name: "Description disambiguation + security-scan test extension"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-320-1"
    content: "Disambiguate the 4 overlapping auto-trigger descriptions"
    skill: "NA"
    agent: "NA"
    outcome: "folders scoped to folder CRUD; categories marked read-only with pointer to organize; calendar-list proactive clause narrowed; email-organize vs categories triggers no longer collide"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-320-2"
    content: "Extend the security static test to scan all skill files"
    skill: "NA"
    agent: "NA"
    outcome: "test/static/security.test.js scans reference.md, params.yaml, and references/*.yaml (not only SKILL.md) for the forbidden token/Bearer/curl patterns; passes"
    status: pending
    complexity: low
    priority: high
  - id: "loop-320-3"
    content: "Add a trigger-word uniqueness assertion to the eval tests"
    skill: "NA"
    agent: "NA"
    outcome: "An eval test asserts no two skill descriptions both match another skill's trigger set; passes"
    status: pending
    complexity: medium
    priority: medium

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Stop wrong-skill auto-selection and make the security scan cover the files where raw API usage actually lives.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-320 HEAD

  ## Success criteria
  - [ ] 4 descriptions disambiguated
  - [ ] security test scans all skill files and passes
  - [ ] trigger-word uniqueness assertion passes

  ## Required skills
  - None (markdown + JS test)

  ## Inputs
  - folders/organize/categories/calendar-list SKILL.md frontmatter; test/static/security.test.js; test/eval/

  ## Expected outputs
  - Disambiguated frontmatter; extended security + eval tests

  ## Constraints
  - Keep the send-vs-draft disambiguation as the model pattern

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Fix the description overlaps that misroute skills and widen the security scan beyond SKILL.md so curl/Bearer can't reappear in reference files.

## Success Criteria
- ✓ Unique triggers; full-file security scan
## Skills Required
### Broad: `technical-writing`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: none (phase close). ### Blocked By: loop-300 (Bearer removed first). ### Parallelisable: none
## Complexity
**Scope**: Medium. **Effort**: 1–2 hours. **Challenge**: description edits that disambiguate without losing legitimate triggers.
