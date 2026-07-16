# Phase 1 — Ralph Loops: Unblock Skills & Lock Scopes

Source phase plan: `.advanced-plans/phases/phase-1/plan.md`
On-max recovery for all loops: `escalate` (implementation — partial code is worse than none).

---

```yaml
---
name: "ralph-loop-100"
task_name: "Single-source scopes + add missing permissions"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-100-1"
    content: "Create a canonical scope source consumed at runtime"
    skill: "NA"
    agent: "NA"
    outcome: "outlook-skills/scopes.json (or a shared module) exists listing the full scope set; auth-server.js reads it instead of a hardcoded array"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-100-2"
    content: "Add Contacts.ReadWrite and MailboxSettings.ReadWrite to the canonical set and confirm openid/profile/email present"
    skill: "NA"
    agent: "NA"
    outcome: "Canonical scope set includes Contacts.ReadWrite, MailboxSettings.ReadWrite, openid, profile, email; auth-server.js SCOPES derives from it"
    status: pending
    complexity: low
    priority: high
  - id: "loop-100-3"
    content: "Regenerate/align every documented permission table from the canonical source"
    skill: "NA"
    agent: "NA"
    outcome: "AZURE_SETUP.md, azure-setup-guide.html, outlook-auth/reference.md, outlook-setup/reference.md list exactly the canonical scopes; no divergent copies remain"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Establish one editable source for the OAuth scope list and add the two scopes that make rules/categories/contacts-write reachable.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-100 HEAD

  ## Success criteria
  - [ ] Scope list appears in exactly one editable source consumed by auth-server.js
  - [ ] Canonical set includes Contacts.ReadWrite + MailboxSettings.ReadWrite + openid/profile/email
  - [ ] All doc permission tables match the canonical source (no drift)

  ## Required skills
  - None (config + doc alignment)

  ## Inputs
  - Current SCOPES: outlook-skills/auth-server.js:64-77
  - Doc tables: setup/AZURE_SETUP.md, setup/azure-setup-guide.html, skills/outlook-auth/reference.md, skills/outlook-setup/reference.md

  ## Expected outputs
  - outlook-skills/scopes.json (canonical) + auth-server.js consuming it
  - Aligned doc tables

  ## Constraints
  - Amendment A2: this replaces per-file scope edits — do NOT leave hardcoded copies
  - Delegated user-consentable scopes only; no application permissions

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary (done / failed / needed)
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Collapse the scope list to a single source and add the missing delegated scopes so contacts-write, rules, and categories stop 403ing. Merges WS5.2 into Phase 1 per amendment A2.

## Success Criteria
- ✓ One canonical scope source; auth-server.js derives from it (grep shows no second hardcoded list)
- ✓ Two new scopes + openid/profile/email present
- ✓ Doc tables match canonical source

## Skills Required
### Broad (from phase plan): `oauth-config`
### Specific: none (JSON/JS + markdown)
### Discovered: none

## Dependencies
### Must Complete Before: loop-120 (scope-contract test asserts against this source)
### Blocked By: nothing — first loop
### Parallelisable: none

## Complexity
**Scope**: Medium — small code change, several doc touch-points
**Estimated effort**: 1–2 hours
**Key challenges**: finding every scope copy; keeping doc format valid while single-sourcing

---

```yaml
---
name: "ralph-loop-110"
task_name: "Endpoint-guard atomic rewrite (MSYS self-heal + segment-exact)"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-110-1"
    content: "Rewrite graph_call.py endpoint validation to strip a leading Windows/Git-Bash drive path before validating"
    skill: "NA"
    agent: "NA"
    outcome: "graph_call.py rewrites an endpoint matching ^[A-Za-z]:/.*/(me|users)(/.*)?$ back to the /me.. or /users.. tail before the prefix check"
    status: pending
    complexity: high
    priority: high
  - id: "loop-110-2"
    content: "Tighten the prefix check to segment-exact and reject residual percent-encoding"
    skill: "NA"
    agent: "NA"
    outcome: "Guard accepts only endpoint == /me, startswith /me/, or startswith /users/; rejects any endpoint still containing % after one unquote"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Fix the Windows path-mangling that breaks all writes AND close the substring/traversal weakness in one atomic validation rewrite.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-110 HEAD

  ## Success criteria
  - [ ] `python scripts/graph_call.py GET "/me"` returns 200 from Git Bash without MSYS_NO_PATHCONV
  - [ ] /messages and /memberOf are rejected; /me, /me/messages, /users/... accepted
  - [ ] Double-encoded traversal (e.g. /me/..%252Ffoo) rejected

  ## Required skills
  - None (Python stdlib)

  ## Inputs
  - Current guard: scripts/graph_call.py:85-92

  ## Expected outputs
  - Rewritten endpoint validation in scripts/graph_call.py

  ## Constraints
  - Amendment A3: 1.2 and 1.3 are ONE change — a greedy strip must not re-open traversal
  - Do not weaken the method allowlist or the token-injection boundary

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Single atomic rewrite of the endpoint guard: self-heal MSYS-mangled paths and enforce a segment-exact `/me` `/users/` check. This is the sole runtime barrier on reachable Graph paths.

## Success Criteria
- ✓ Windows `/me` works without env workaround
- ✓ Substring lookalikes and double-encoded traversal rejected
- ✓ Legit endpoints still pass

## Skills Required
### Broad: `python-tooling`
### Specific: none
### Discovered: none

## Dependencies
### Must Complete Before: loop-120 (validation table test targets this)
### Blocked By: nothing
### Parallelisable: loop-100 (different file)

## Complexity
**Scope**: High — security-sensitive, easy to get subtly wrong
**Estimated effort**: 2–3 hours
**Key challenges**: strip regex that heals mangling without opening traversal; covering fixtures

---

```yaml
---
name: "ralph-loop-120"
task_name: "Scope-contract + endpoint-validation tests + CI python"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-120-1"
    content: "Scaffold a Python test tier runnable from npm"
    skill: "NA"
    agent: "NA"
    outcome: "test/python/ exists; a documented command (npm run test:python or equivalent) runs pytest/unittest and is wired into npm test"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-120-2"
    content: "Write endpoint-validation table test including Git-Bash-mangled fixtures"
    skill: "NA"
    agent: "NA"
    outcome: "Test enumerates allowed (/me, /me/messages, /users/x) and blocked (/messages, /memberOf, mangled drive path, double-encoded traversal) cases; all pass against the loop-110 guard"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-120-3"
    content: "Write fail-closed scope-contract test mapping SKILL.md verb+endpoint to required scope"
    skill: "NA"
    agent: "NA"
    outcome: "Test parses each SKILL.md graph_call line, maps GET->read-tier and write verbs->write-tier scope, asserts canonical SCOPES covers all; unknown endpoint => test failure"
    status: pending
    complexity: high
    priority: high
  - id: "loop-120-4"
    content: "Add a Python compile/test step to CI"
    skill: "NA"
    agent: "NA"
    outcome: ".github/workflows/test.yml runs python -m py_compile on graph_call.py/token_helper.py and the new test tier"
    status: pending
    complexity: low
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Lock loops 100 and 110 behind tests, and permanently guard the scope class of bug with a fail-closed contract test.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-120 HEAD

  ## Success criteria
  - [ ] Python test tier runs from npm and in CI
  - [ ] Endpoint-validation test passes with mangled + malicious fixtures
  - [ ] Scope-contract test passes and fails if a scope is removed (verify by temporary removal)
  - [ ] Unknown endpoint in a SKILL.md causes test failure (fail-closed)

  ## Required skills
  - None (Python test + YAML)

  ## Inputs
  - Guard from loop-110; canonical scopes from loop-100; skills/*/SKILL.md graph_call lines

  ## Expected outputs
  - test/python/ suite; CI python step

  ## Constraints
  - Amendment A5: GET verbs map to read-tier scope; fail closed on unmapped endpoints
  - T2: inject clock / mock urlopen; do not invoke real icacls or sleep in unit tests

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Create the behavioral Python test tier and the fail-closed scope-contract test that makes the "skill needs an unrequested scope" bug impossible to reintroduce.

## Success Criteria
- ✓ New tier runs locally + CI
- ✓ Validation + scope-contract tests pass and are provably failing when the fix is reverted

## Skills Required
### Broad: `python-tooling`, `ci-cd`
### Specific: none
### Discovered: none

## Dependencies
### Must Complete Before: none (last verification loop before migration banner)
### Blocked By: loop-100 (scopes) + loop-110 (guard)
### Parallelisable: none

## Complexity
**Scope**: High — new test infrastructure + a nontrivial scope map
**Estimated effort**: 3–4 hours
**Key challenges**: reliable verb+endpoint→scope map; keeping it fail-closed and small

---

```yaml
---
name: "ralph-loop-130"
task_name: "Re-auth scope-drift migration banner"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-130-1"
    content: "Compare stored token scopes against required scopes and surface a re-auth prompt"
    skill: "NA"
    agent: "NA"
    outcome: "token_helper raises AuthRequiredError('re-auth needed for updated permissions') (or equivalent) when tokens.json.scopes lacks a required scope, instead of a silent 403 at call time"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-130-2"
    content: "Show scope drift in the auth status output"
    skill: "NA"
    agent: "NA"
    outcome: "auth.ps1 -Status / auth.sh --status prints a 'run --reauth for new permissions' banner when stored scopes are missing any required scope"
    status: pending
    complexity: low
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Turn the silent post-update 403 (existing users lack the new scopes) into an actionable re-auth prompt.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-130 HEAD

  ## Success criteria
  - [ ] A stale tokens.json (missing new scopes) triggers a clear re-auth message, not a 403
  - [ ] --status shows the drift banner

  ## Required skills
  - None (Python + Node status paths)

  ## Inputs
  - Canonical required scopes (loop-100); token_helper.get_token / get_session_info; auth-server.js --status

  ## Expected outputs
  - Scope-drift check in token_helper + status banner

  ## Constraints
  - C1: silent refresh cannot acquire new scopes; only --reauth can
  - Do not read/print token material in the banner

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Add the migration UX: detect that an existing token grant predates the new scopes and tell the user to re-auth, rather than letting rules/categories/contacts silently 403.

## Success Criteria
- ✓ Stale-scope tokens produce an actionable prompt
- ✓ Status output flags the drift

## Skills Required
### Broad: `oauth-config`
### Specific: none
### Discovered: none

## Dependencies
### Must Complete Before: none (phase close)
### Blocked By: loop-100 (required scope set)
### Parallelisable: loop-120

## Complexity
**Scope**: Medium
**Estimated effort**: 1–2 hours
**Key challenges**: comparing scope sets robustly (order/case); not leaking token data
