# Phase 2 — Ralph Loops: Auth & Security Core

Source phase plan: `.advanced-plans/phases/phase-2/plan.md`
On-max recovery for all loops: `escalate` (security-sensitive implementation).

---

```yaml
---
name: "ralph-loop-200"
task_name: "Dependency-free .env loader + prove refresh"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-200-1"
    content: "Add a dependency-free .env parser to token_helper.py"
    skill: "NA"
    agent: "NA"
    outcome: "token_helper.py loads OUTLOOK_CLIENT_SECRET/CLIENT_ID/TENANT_ID from outlook-skills/.env without requiring python-dotenv (mirrors auth-server.js loadEnv)"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-200-2"
    content: "Prove silent refresh works from .env alone (no dotenv, no stored secret)"
    skill: "NA"
    agent: "NA"
    outcome: "A test refreshes an expired access token using only .env for the secret (dotenv uninstalled, tokens.json secret absent), asserting a new access token is returned"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Guarantee refresh has a secret source that does NOT depend on python-dotenv, before the next loop removes the stored secret.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-200 HEAD

  ## Success criteria
  - [ ] token_helper reads .env without python-dotenv
  - [ ] Refresh proven to work from .env alone (test)

  ## Required skills
  - None (Python stdlib)

  ## Inputs
  - token_helper.py:37-42 (dotenv try/except), :105 (secret lookup); auth-server.js loadEnv as reference

  ## Expected outputs
  - Dependency-free env loader + a passing refresh test

  ## Constraints
  - Amendment A1: this MUST land before loop-210 drops the stored secret
  - Keep the token-injection boundary intact

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
The load-bearing prerequisite of the whole security phase: make `.env` a reliable secret source so removing the on-disk secret can't kill refresh on a machine without `python-dotenv`.

## Success Criteria
- ✓ Env parsed without dotenv; refresh proven from `.env` alone
## Skills Required
### Broad: `python-tooling`, `oauth-security`
### Specific/Discovered: none
## Dependencies
### Must Complete Before: loop-210 (hard gate, A1)
### Blocked By: Phase 1 complete
### Parallelisable: none
## Complexity
**Scope**: Medium — small parser, important test. **Effort**: 1–2 hours. **Challenge**: matching auth-server.js parsing exactly (quotes/comments).

---

```yaml
---
name: "ralph-loop-210"
task_name: "Drop client_secret at rest + refresh lock + mode-600"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-210-1"
    content: "Stop writing client_secret into tokens.json"
    skill: "NA"
    agent: "NA"
    outcome: "auth-server.js no longer persists client_secret; a freshly written tokens.json contains no client_secret key"
    status: pending
    complexity: low
    priority: high
  - id: "loop-210-2"
    content: "Create tokens.json with restrictive permissions at write time"
    skill: "NA"
    agent: "NA"
    outcome: "auth-server.js writes tokens.json with mode 0600 (POSIX) and runs icacls on win32 immediately at creation, not only on refresh"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-210-3"
    content: "Add a refresh lock and unique tmp filename to prevent concurrent-write corruption"
    skill: "NA"
    agent: "NA"
    outcome: "token_helper refresh takes an advisory lock, writes a per-process/unique tmp file, re-checks expiry under lock; a concurrent-invocation stress test does not corrupt tokens.json"
    status: pending
    complexity: high
    priority: high
  - id: "loop-210-4"
    content: "Gitignore all token tmp files"
    skill: "NA"
    agent: "NA"
    outcome: ".gitignore entry outlook-skills/tokens.json* covers the tmp/per-pid files"
    status: pending
    complexity: low
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Remove the persisted secret and make token writes safe: restrictive perms from creation, no concurrent-write corruption.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-210 HEAD

  ## Success criteria
  - [ ] No client_secret in a freshly written tokens.json
  - [ ] tokens.json created mode-600 / icacls at creation
  - [ ] Concurrent graph_call.py stress test leaves tokens.json valid
  - [ ] .gitignore covers tokens.json*

  ## Required skills
  - None (Node + Python)

  ## Inputs
  - auth-server.js:241-253 (writer); token_helper.py:77-92 (_save_tokens), :97-159 (refresh)

  ## Expected outputs
  - Secret-free writer; locked, atomic refresh; gitignore update

  ## Constraints
  - Depends on loop-200 (.env secret source proven)
  - 2.3 + 2.5 land together (shared refresh path); existing token files keep working until --reauth

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
The riskiest change in the programme, gated by loop-200. Removes the at-rest secret and hardens the write/refresh path against races and permission leaks.

## Success Criteria
- ✓ Secret-free, mode-600 token file; race-safe refresh
## Skills Required
### Broad: `oauth-security`, `python-tooling`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: loop-230 (behavioral tests assume final refresh path)
### Blocked By: loop-200 (A1). ### Parallelisable: loop-220 (different concern)
## Complexity
**Scope**: High. **Effort**: 3–4 hours. **Challenges**: cross-runtime advisory lock (msvcrt/fcntl); not breaking existing token files.

---

```yaml
---
name: "ralph-loop-220"
task_name: "Callback hardening — state, host, escaping, timeouts"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-220-1"
    content: "Generate and strictly validate a single-use OAuth state, plus a Host-header check"
    skill: "NA"
    agent: "NA"
    outcome: "auth-server.js sets state=crypto.randomBytes hex, stores it, rejects any /auth/callback whose state mismatches or is reused, and rejects non-localhost Host headers"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-220-2"
    content: "HTML-escape all values interpolated into callback pages"
    skill: "NA"
    agent: "NA"
    outcome: "query.error, error_description, email, and error.message are HTML-escaped (or served as text) in every callback/error response"
    status: pending
    complexity: low
    priority: high
  - id: "loop-220-3"
    content: "Add server deadline and token-exchange request timeout"
    skill: "NA"
    agent: "NA"
    outcome: "auth-server.js shuts down after a 10-minute idle deadline; the code-for-token https.request has a 30s timeout that aborts cleanly"
    status: pending
    complexity: medium
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Make the localhost OAuth callback safe against CSRF, reflected content, and hung/abandoned sessions.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-220 HEAD

  ## Success criteria
  - [ ] Callback rejects missing/mismatched/reused state and non-localhost Host
  - [ ] No unescaped user-controlled value in any callback HTML
  - [ ] Server self-terminates after 10 min; token exchange times out at 30s

  ## Required skills
  - None (Node http/crypto)

  ## Inputs
  - auth-server.js:197-268 (auth + callback), :136-177 (exchange), :289-305 (listen)

  ## Expected outputs
  - Hardened auth-server.js callback + lifecycle

  ## Constraints
  - CSRF = a malicious page tricking the browser into hitting the local callback with an attacker's code
  - Parallelisable with loop-210 (distinct code)

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Harden the auth server's HTTP surface: real state validation, host pinning, output escaping, and timeouts so an abandoned or attacked flow can't linger or inject tokens.

## Success Criteria
- ✓ CSRF-safe callback; no reflected content; bounded lifetime
## Skills Required
### Broad: `oauth-security`, `node-http`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: loop-230. ### Blocked By: nothing in-phase. ### Parallelisable: loop-210
## Complexity
**Scope**: Medium. **Effort**: 2–3 hours. **Challenge**: single-use state storage across the request pair.

---

```yaml
---
name: "ralph-loop-230"
task_name: "Force-refresh on 401 + behavioral token tests"
max_iterations: 3
on_max_iterations: escalate

handoff_summary:
  done: ""
  failed: ""
  needed: ""

todos:
  - id: "loop-230-1"
    content: "Add get_token(force_refresh=True) and use it on the graph_call 401 retry"
    skill: "NA"
    agent: "NA"
    outcome: "token_helper.get_token accepts force_refresh that bypasses the local-expiry short-circuit; graph_call.py retry path calls it so a server-side 401 triggers a real refresh"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-230-2"
    content: "Map transient refresh failures to an actionable status instead of opaque 500"
    skill: "NA"
    agent: "NA"
    outcome: "graph_call.py catches TokenRefreshError and returns 503 token_refresh_failed with a retry hint; network errors in refresh raise TokenRefreshError not a raw exception"
    status: pending
    complexity: medium
    priority: high
  - id: "loop-230-3"
    content: "Write behavioral token_helper tests with mocked endpoint and injected clock"
    skill: "NA"
    agent: "NA"
    outcome: "Tests cover refresh 200, invalid_grant->AuthRequiredError, network error->TokenRefreshError, access-token expiry, and 30-day session wipe; no real icacls/sleep; npm test green"
    status: pending
    complexity: high
    priority: high

prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Make the advertised 401 auto-refresh actually work, and cover the token lifecycle with behavioral tests.

  ## Checkpoint (run first, main thread)
  git tag -f checkpoint/ralph-loop-230 HEAD

  ## Success criteria
  - [ ] A server-side 401 with a locally-unexpired token triggers a real refresh (test)
  - [ ] Transient refresh failure -> 503 with retry hint, not 500
  - [ ] Behavioral suite covers success/invalid_grant/network/expiry/wipe; green

  ## Required skills
  - None (Python test)

  ## Inputs
  - graph_call.py:156-165 (retry); token_helper.py:132-159, :188-195

  ## Expected outputs
  - force_refresh path; error mapping; token_helper test suite

  ## Constraints
  - T2: monkeypatch urllib.request.urlopen; inject/freeze clock; assert mode logic via a seam

  ## On completion (signal — do NOT commit)
  1. Update handoff_summary
  2. Mark all todos completed
  3. Write .advanced-plans/state/loop-complete.json

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---
```

## Overview
Fix the no-op 401 retry and add the behavioral coverage that Phase 1 left for the token lifecycle.

## Success Criteria
- ✓ Real forced refresh on 401; actionable transient errors; full lifecycle tests
## Skills Required
### Broad: `python-tooling`. ### Specific/Discovered: none
## Dependencies
### Must Complete Before: none (phase close). ### Blocked By: loop-210 (final refresh path). ### Parallelisable: none
## Complexity
**Scope**: High. **Effort**: 3–4 hours. **Challenge**: deterministic mocks for the refresh endpoint and clock.
