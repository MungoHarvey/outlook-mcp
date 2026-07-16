# Phase 5 — Ralph Loops: Documentation Truth

Source phase plan: `.advanced-plans/phases/phase-5/plan.md`

---

```yaml
---
name: "ralph-loop-500"
task_name: "Rewrite setup/auth READMEs + auth reference"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-500-1"
    content: "Rewrite outlook-skills/README.md and setup/README.md to match the real system"
    skill: "NA"
    agent: "NA"
    outcome: "Both READMEs remove false claims (AES-256, OS keychain, PKCE, 'secret never written to disk'), use redirect URI /auth/callback, and describe the actual .env/tokens.json/auth-server.js flow"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-500-2"
    content: "Correct skills/outlook-auth/reference.md (the first-time-auth guide Claude loads)"
    skill: "NA"
    agent: "NA"
    outcome: "reference.md uses redirect URI /auth/callback, replaces ~/.skills/config.json instructions with the .env flow (cp .env.example, three OUTLOOK_* vars), and drops the MS_TENANT_ID bullet"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Make the setup and first-time-auth docs describe the system that exists, with the correct redirect URI and no false security claims.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-500 HEAD

  ## Success criteria
  - [ ] No AES-256/keychain/PKCE/"never written to disk" claims remain
  - [ ] Redirect URI is /auth/callback everywhere in these files
  - [ ] auth reference uses the real .env flow

  ## Required skills
  - None (technical writing)

  ## Inputs
  - outlook-skills/README.md, setup/README.md, skills/outlook-auth/reference.md; actual behavior from auth-server.js/.env/tokens.json

  ## Expected outputs
  - Truthful setup/auth docs

  ## Constraints
  - Docs describe FINAL (post Phase 1-4) behavior
  - Consistency enforced by the Phase 4 doc-consistency test

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Rewrite the two setup READMEs and the auth reference so they stop teaching a wrong redirect URI and false security model.

## Success Criteria
- ✓ Honest, correct setup/auth docs; doc-consistency test green
## Skills Required
### Broad: `technical-writing`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: none. ### Blocked By: Phase 4 (consistency test). ### Parallelisable: loop-510
## Complexity
**Scope**: Medium. **Effort**: 2 hours.

---

```yaml
---
name: "ralph-loop-510"
task_name: "Rewrite root README + CLAUDE.md"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-510-1"
    content: "Rewrite root README architecture, counts, and artifact names"
    skill: "NA"
    agent: "NA"
    outcome: "README describes the skills + graph_call.py architecture (not 'two MCP tools'), states the correct skill count (20 folders / 18 invocable), names the real zip artifact, and fixes the broken #quick-start anchor"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-510-2"
    content: "Correct CLAUDE.md setup and architecture tree"
    skill: "NA"
    agent: "NA"
    outcome: "CLAUDE.md removes the uv/.venv bootstrap fiction, describes the real Node-only auth + pip dependency path, adds/labels mcp-server per the Phase 4 decision, and qualifies the 'all calls via graph_call.py' claim"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Align the top-level README and CLAUDE.md with the real architecture, counts, and dependency path.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-510 HEAD

  ## Success criteria
  - [ ] README architecture/counts/artifact correct; anchor fixed
  - [ ] CLAUDE.md setup + tree match reality; mcp-server handled per Phase 4 decision

  ## Required skills
  - None (technical writing)

  ## Inputs
  - README.md; CLAUDE.md; Phase 4 mcp-server decision record

  ## Expected outputs
  - Corrected README + CLAUDE.md

  ## Constraints
  - Use the Phase 4 mcp-server decision as the single source (resolves 6.4 vs 6.5)

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Fix the root README's wrong architecture story and CLAUDE.md's invented bootstrap, consuming Phase 4's mcp-server decision.

## Success Criteria
- ✓ Accurate README + CLAUDE.md
## Skills Required
### Broad: `technical-writing`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: none. ### Blocked By: Phase 4 (mcp-server decision). ### Parallelisable: loop-500
## Complexity
**Scope**: Medium. **Effort**: 2 hours.

---

```yaml
---
name: "ralph-loop-520"
task_name: "Sweep planning/research debris"
max_iterations: 3
on_max_iterations: checkpoint

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-520-1"
    content: "Archive or move MCP-era planning and research debris out of the plugin"
    skill: "NA"
    agent: "NA"
    outcome: "Legacy .claude/plans/ MCP-era files and research/ are moved to the parent repo or an archive/ location; the shipped plugin no longer carries contradictory internal plans"
    status: pending
    complexity: medium
    priority: medium
  - id: "loop-520-2"
    content: "Untrack committed loop-complete JSONs and confirm no resurrection of deleted scripts"
    skill: "NA"
    agent: "NA"
    outcome: "git rm --cached the committed loop-complete*.json; no remaining plan/loop file instructs recreating the deleted deprecated scripts"
    status: pending
    complexity: low
    priority: medium

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Remove stale planning/research artifacts so the plugin doesn't ship contradictory internal state.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-520 HEAD

  ## Success criteria
  - [ ] MCP-era plans/research archived or moved out of the plugin
  - [ ] No committed loop-complete*.json; no instructions to recreate deleted scripts

  ## Required skills
  - None (repo hygiene)

  ## Inputs
  - .claude/plans/ (legacy), research/, committed loop-complete*.json

  ## Expected outputs
  - Cleaned repo; archived debris

  ## Constraints
  - Archive rather than hard-delete; verify no active ralph loop references the moved files
  - Do NOT touch .advanced-plans/ (this remediation programme's own plans)

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Final hygiene sweep: move MCP-era plans/research out of the shipped plugin and untrack the committed loop JSONs, without disturbing this programme's `.advanced-plans/`.

## Success Criteria
- ✓ Debris archived; no committed loop JSONs
## Skills Required
### Broad: `repo-hygiene`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: none (programme close). ### Blocked By: loop-510 (docs reference some plans). ### Parallelisable: none
## Complexity
**Scope**: Medium. **Effort**: 1–2 hours. **Challenge**: distinguishing legacy debris from live `.advanced-plans/`.
