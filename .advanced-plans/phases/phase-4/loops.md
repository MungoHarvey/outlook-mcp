# Phase 4 — Ralph Loops: Deduplication & Tooling

Source phase plan: `.advanced-plans/phases/phase-4/plan.md`

---

```yaml
---
name: "ralph-loop-400"
task_name: "Deduplicate references into outlook-base + link-resolution test"
max_iterations: 3
on_max_iterations: checkpoint

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-400-1"
    content: "Establish canonical reference files in outlook-base/references and repoint all cross-skill links"
    skill: "NA"
    agent: "NA"
    outcome: "errors.yaml, graph-api-patterns.yaml, timezones.yaml, colors.yaml exist once in skills/outlook-base/references/; the 29 per-skill links point to ../outlook-base/references/<file>"
    status: pending
    complexity: high
    priority: high
  - id: "loop-400-2"
    content: "Delete the duplicate reference files and the duplicate calendar params.yaml"
    skill: "NA"
    agent: "NA"
    outcome: "The 30 duplicate reference files are removed (~56KB); calendar-update links to calendar-create params.yaml; no skill folder holds a byte-copy of an outlook-base reference"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-400-3"
    content: "Extend cross-references test to assert every link resolves"
    skill: "NA"
    agent: "NA"
    outcome: "test/static/cross-references.test.js fails if any repointed reference link targets a nonexistent file; passes on the deduped tree"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Collapse 56KB of duplicated reference YAML to single canonical copies without silently breaking any skill's reference link.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-400 HEAD

  ## Success criteria
  - [ ] Canonical references only in outlook-base; 29 links repointed
  - [ ] 30 duplicates deleted; no byte-identical copies remain
  - [ ] Link-resolution test passes and would fail on a dangling link

  ## Required skills
  - None (file ops + JS test)

  ## Inputs
  - skills/*/references/*.yaml (dup map); test/static/cross-references.test.js

  ## Expected outputs
  - Deduped references; extended test

  ## Constraints
  - Amendment A6: a mis-pointed link fails silently at runtime — the test must catch it
  - Must run AFTER Phase 3 content fixes

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Mechanical but blast-prone dedup: single-source the reference YAML and guarantee every repointed link resolves. `checkpoint` recovery preserves partial dedup progress.

## Success Criteria
- ✓ −56KB dup; all links resolve (test-enforced)
## Skills Required
### Broad: `refactoring`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: none. ### Blocked By: Phase 3 complete. ### Parallelisable: loop-410
## Complexity
**Scope**: High (blast radius). **Effort**: 2–3 hours. **Challenge**: silent link breakage — mitigated by A6 test.

---

```yaml
---
name: "ralph-loop-410"
task_name: "Single-source version + 30-day constant + engines bump"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-410-1"
    content: "Reconcile the version across manifests and add a CHANGELOG"
    skill: "NA"
    agent: "NA"
    outcome: "plugin.json and package.json share one version; CHANGELOG.md exists; plugin.json has license/repository/homepage fields"
    status: pending
    complexity: low
    priority: high
  - id: "loop-410-2"
    content: "Single-source the 30-day session constant and fix the --status off-by-one"
    skill: "NA"
    agent: "NA"
    outcome: "MAX_SESSION_AGE defined once per runtime; auth-server.js --status uses floor((MAX-age)/86400) matching token_helper; remaining-days agree for the same token"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-410-3"
    content: "Bump engines.node to match runtime requirements"
    skill: "NA"
    agent: "NA"
    outcome: "package.json engines.node is >=16 (or >=18 to match CI), fixing the base64url id_token decode on old Node"
    status: pending
    complexity: low
    priority: medium

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  One version, one session constant, correct engine floor.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-410 HEAD

  ## Success criteria
  - [ ] Version identical across plugin.json/package.json; CHANGELOG present
  - [ ] --status and token_helper report the same remaining days
  - [ ] engines.node >=16/18

  ## Required skills
  - None

  ## Inputs
  - plugin.json:3, package.json:3,34, mcp-server/src/index.js:31; token_helper.py:35/209, auth-server.js:105-108

  ## Expected outputs
  - Synced version + CHANGELOG; single 30-day constant; engines bump

  ## Constraints
  - Amendment A8 (base64url needs Node>=16)

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Single-source version metadata and the session constant, and fix the day-math discrepancy and Node engine floor.

## Success Criteria
- ✓ Consistent version + session math; correct engines
## Skills Required
### Broad: `refactoring`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: none. ### Blocked By: nothing in-phase. ### Parallelisable: loop-400
## Complexity
**Scope**: Low-Medium. **Effort**: 1–2 hours.

---

```yaml
---
name: "ralph-loop-420"
task_name: "Remove deprecated code + fix test globs"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-420-1"
    content: "Delete deprecated scripts and their npm entries"
    skill: "NA"
    agent: "NA"
    outcome: "scripts/outlook-auth-server.js and scripts/outlook-token-refresh.js removed; auth-server/token-refresh npm script entries gone; no repo reference remains except archived plans"
    status: pending
    complexity: low
    priority: high
  - id: "loop-420-2"
    content: "Delete the deprecated unit tests and repoint the test globs"
    skill: "NA"
    agent: "NA"
    outcome: "test/unit/auth-server.test.js and token-refresh.test.js removed; package.json test and test:unit globs updated so npm test passes with the dir emptied/repointed to the Python tier"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Remove the dead deprecated auth code and the tests that only cover it, without breaking npm test.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-420 HEAD

  ## Success criteria
  - [ ] Deprecated scripts + npm entries gone
  - [ ] Deprecated unit tests gone; globs updated; npm test green

  ## Required skills
  - None

  ## Inputs
  - scripts/outlook-*.js; package.json:6-8,11; test/unit/*.test.js

  ## Expected outputs
  - Removed dead code; working test globs

  ## Constraints
  - Amendment A4: node --test errors on a zero-match glob — update globs in the SAME change
  - Grep first to confirm nothing live references the scripts

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Delete the deprecated port-3333 scripts and their shallow tests, updating the npm globs so the suite still runs.

## Success Criteria
- ✓ Dead code gone; suite green
## Skills Required
### Broad: `refactoring`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: none. ### Blocked By: nothing in-phase. ### Parallelisable: loop-410
## Complexity
**Scope**: Low-Medium. **Effort**: 1 hour. **Challenge**: the glob-breaks-npm-test trap (A4).

---

```yaml
---
name: "ralph-loop-430"
task_name: "Setup-script fixes + CI matrix/linters + doc-consistency test + mcp-server decision"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-430-1"
    content: "Make install idempotent and fix cross-platform script bugs"
    skill: "NA"
    agent: "NA"
    outcome: "Re-running install twice produces no nested outlook-x/outlook-x folders; package.ps1 does the guide path rewrite; sed -i is portable (no SKILL.md-e files); install.ps1 uses $authSh"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-430-2"
    content: "Add windows CI leg, script linters, and a doc-consistency test"
    skill: "NA"
    agent: "NA"
    outcome: ".github/workflows/test.yml runs on ubuntu+windows with shellcheck + PSScriptAnalyzer; a doc-consistency test asserts the exact redirect URI and each required scope token across README/AZURE_SETUP/guide (presence, not list-equality)"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-430-3"
    content: "Resolve mcp-server fate as one explicit decision"
    skill: "NA"
    agent: "NA"
    outcome: "A recorded decision (keep-documented vs delete) with a grep of all references; if kept, committed node_modules addressed; decision written for Phase 5 to consume"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Make setup scripts and CI trustworthy on both platforms, guard doc drift with a test, and settle mcp-server's fate.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-430 HEAD

  ## Success criteria
  - [ ] Idempotent installer; package.ps1 parity; portable sed; install.ps1 var fixed
  - [ ] CI ubuntu+windows with shell/PS linting; doc-consistency test passes
  - [ ] mcp-server decision recorded (with reference grep)

  ## Required skills
  - None (shell/PS + CI YAML)

  ## Inputs
  - setup/install.sh, install.ps1, package.sh, package.ps1; .github/workflows/test.yml; mcp-server/

  ## Expected outputs
  - Fixed scripts; CI matrix + linters; doc-consistency test; mcp-server decision record

  ## Constraints
  - Amendment A7: resolve the 6.4-vs-6.5 contradiction here so Phase 5 has one source of truth
  - T3: doc-consistency test uses presence checks, not list equality

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Close out tooling: idempotent cross-platform setup, a real CI matrix with linters, the doc-consistency guard, and the mcp-server keep/delete decision that Phase 5 depends on.

## Success Criteria
- ✓ Idempotent install; two-platform CI; doc test; recorded mcp-server decision
## Skills Required
### Broad: `ci-cd`, `shell-scripting`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: Phase 5 (mcp-server decision). ### Blocked By: nothing in-phase. ### Parallelisable: loop-410
## Complexity
**Scope**: Medium-High. **Effort**: 3–4 hours. **Challenge**: PSScriptAnalyzer/shellcheck on Windows CI; the mcp-server call.
