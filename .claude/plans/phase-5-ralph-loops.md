---
loop: ralph-loop-500
name: Security and API Call Tests
task_name: Security and API Call Tests
max_iterations: 6
on_max_iterations: escalate
handoff_summary:
  done: "Created test/static/security.test.js (5 token-leak pattern checks) and test/eval/api-call-structure.test.js (graph_call.py validation for 16 skills); added test:security npm script; prohibition docs rephrased to avoid false positives; all test suites pass."
  failed: ""
  needed: "Loop 501 should annotate deprecated unit tests and rewrite integration smoke test to use graph_call.py."
todos:
  - id: "500-1"
    content: "Create test/static/security.test.js that scans all .claude/skills/ SKILL.md files for forbidden token patterns: (1) get_token( — LLM should never call this, (2) token_helper — should never import, (3) outlook-mcp-tokens.json — old plaintext path, (4) $TOKEN — old shell variable, (5) access_token — raw token value; the test file itself must be excluded from its own scan"
    skill: "NA"
    agent: "worker"
    outcome: "test/static/security.test.js exists; running it produces zero failures; each of the 5 forbidden patterns is tested as a separate assertion across all SKILL.md files"
    status: completed
    priority: high
  - id: "500-2"
    content: "Create test/eval/api-call-structure.test.js that replaces curl-structure.test.js: validate that every operation skill SKILL.md contains 'python3 scripts/graph_call.py' as the API call pattern; validate correct HTTP methods per skill (GET for list/read, POST for send/create/reply/move/respond, PATCH for update/organize, DELETE for delete); validate endpoint patterns match Graph API conventions"
    skill: "NA"
    agent: "worker"
    outcome: "test/eval/api-call-structure.test.js exists and passes; it checks graph_call.py presence in all 16 operation skills and validates HTTP method correctness"
    status: completed
    priority: high
  - id: "500-3"
    content: "Read package.json and add a 'test:security' script that runs only test/static/security.test.js: 'node --test test/static/security.test.js'"
    skill: "NA"
    agent: "worker"
    outcome: "package.json contains a test:security script; running npm run test:security exits 0"
    status: completed
    priority: high
  - id: "500-4"
    content: "Run the new security tests and api-call-structure tests to confirm they pass: npm run test:security and node --test test/eval/api-call-structure.test.js"
    skill: "NA"
    agent: "worker"
    outcome: "npm run test:security exits 0 with 0 failures; api-call-structure.test.js exits 0 with 0 failures"
    status: completed
    priority: high
  - id: "500-5"
    content: "Run full static and eval test suites to confirm nothing is broken: npm run test:static and npm run test:eval"
    skill: "NA"
    agent: "worker"
    outcome: "npm run test:static exits 0 (204/204 pass); npm run test:eval has expected failures in curl-structure (deprecated) but api-call-structure passes all 33 tests"
    status: completed
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Create security.test.js (structural scan for token leakage in SKILL.md files) and api-call-structure.test.js (replaces curl-structure.test.js), add test:security npm script, and confirm all test suites pass.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-500"

  ## Success criteria
  - [ ] test/static/security.test.js exists; scans 5 forbidden patterns across all SKILL.md files
  - [ ] test/eval/api-call-structure.test.js exists; validates graph_call.py presence in all 16 skills
  - [ ] package.json has test:security script
  - [ ] npm run test:security exits 0
  - [ ] npm run test:static exits 0 (198+ pass)
  - [ ] npm run test:eval exits 0

  ## Key patterns for security.test.js
  Forbidden in any SKILL.md (excluding the security test file itself):
  - `get_token(` — LLM calling token function directly
  - `token_helper` — importing the module directly
  - `outlook-mcp-tokens.json` — old plaintext token file path
  - `$TOKEN` — old shell variable pattern
  - `access_token` — raw token value reference

  ## Key patterns for api-call-structure.test.js
  Every operation SKILL.md must contain: `python3 scripts/graph_call.py`
  The old curl-structure.test.js checked for curl patterns — this replaces that logic.

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-500 — security.test.js and api-call-structure.test.js created"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 500 creates two new test files that enforce the security architecture going forward. `security.test.js` is a structural lint scan — like the existing `skill-structure.test.js` but focused on token leakage patterns. `api-call-structure.test.js` replaces the now-obsolete `curl-structure.test.js` with checks for `graph_call.py` invocation patterns.

## Success Criteria
- ✓ `test/static/security.test.js` exists; 5 token-leak patterns tested across all SKILL.md files; 0 failures
- ✓ `test/eval/api-call-structure.test.js` exists; graph_call.py validated in all 16 operation skills
- ✓ `package.json` `test:security` script present
- ✓ `npm run test:security` exits 0
- ✓ `npm run test:static` exits 0

## Skills Required

### Broad (from phase plan):
- `javascript-testing`: Writing `node:test` assertions

### Specific:
- Pattern: follow `test/static/skill-structure.test.js` as the template for security.test.js

## Inputs
| Input | Source | Format |
|-------|--------|--------|
| Existing static test | `test/static/skill-structure.test.js` | JS (template to follow) |
| Existing eval test | `test/eval/curl-structure.test.js` | JS (to replace) |
| package.json | `package.json` | JSON |

## Outputs
| Output | Location | Format |
|--------|----------|--------|
| Security test | `test/static/security.test.js` | JavaScript |
| API call structure test | `test/eval/api-call-structure.test.js` | JavaScript |
| Updated package config | `package.json` | JSON |

## Dependencies
### Must Complete Before
- Phase 3 (all skills migrated to graph_call.py) — so the tests actually pass

## Complexity
**Scope**: Low — new test files follow existing patterns; no complex logic

---
---
loop: ralph-loop-501
name: Update Unit and Integration Tests
task_name: Update Unit and Integration Tests
max_iterations: 6
on_max_iterations: escalate
handoff_summary:
  done: "Annotated auth-server.test.js and token-refresh.test.js as deprecated; rewrote smoke.test.js to use graph_call.py with no token file reads; npm run test:unit exits 0."
  failed: ""
  needed: "Loop 502 should update CLAUDE.md security architecture, .gitignore, deprecate old Node.js scripts, and run final verification."
todos:
  - id: "501-1"
    content: "Read test/unit/auth-server.test.js and update it: the file currently imports scripts/outlook-auth-server.js and tests OAuth callback handling with ~/.outlook-mcp-tokens.json; add a comment block at the top marking it as testing a deprecated script; update any TOKEN_PATH references from ~/.outlook-mcp-tokens.json to note it is the legacy path; ensure the test still runs without errors (it tests a deprecated but still-present script)"
    skill: "NA"
    agent: "worker"
    outcome: "test/unit/auth-server.test.js has a DEPRECATED comment at top; TOKEN_PATH references are annotated; npm run test:unit exits 0"
    status: completed
    priority: high
  - id: "501-2"
    content: "Read test/unit/token-refresh.test.js and update it: add a comment block marking it as testing a deprecated script; ensure the test still runs without errors"
    skill: "NA"
    agent: "worker"
    outcome: "test/unit/token-refresh.test.js has a DEPRECATED comment at top; npm run test:unit exits 0"
    status: completed
    priority: high
  - id: "501-3"
    content: "Rewrite test/integration/smoke.test.js: replace the direct token file read (TOKEN_PATH + fs.readFileSync) and curl calls with python3 scripts/graph_call.py calls; the test should call 'python3 scripts/graph_call.py GET /me' and verify the response is {\"status\": 200, \"data\": {...}}; remove all references to ~/.outlook-mcp-tokens.json and direct Bearer token usage; keep the OUTLOOK_INTEGRATION_TEST=true env guard"
    skill: "NA"
    agent: "worker"
    outcome: "test/integration/smoke.test.js uses execSync('python3 scripts/graph_call.py GET \"/me\"') instead of curl+token; no references to ~/.outlook-mcp-tokens.json or access_token remain; test still skips unless OUTLOOK_INTEGRATION_TEST=true"
    status: completed
    priority: high
  - id: "501-4"
    content: "Run npm test to confirm all test suites pass (static + unit + eval); integration tests should be skipped by default"
    skill: "NA"
    agent: "worker"
    outcome: "npm test exits 0; all static, unit, and eval tests pass; integration tests are skipped (not failed)"
    status: completed
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Update unit tests to acknowledge deprecated Node.js scripts and rewrite the integration smoke test to use graph_call.py instead of direct token reads and curl commands.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-501"

  ## Success criteria
  - [ ] test/unit/auth-server.test.js annotated as deprecated; still passes
  - [ ] test/unit/token-refresh.test.js annotated as deprecated; still passes
  - [ ] test/integration/smoke.test.js uses graph_call.py; no token file reads; no Bearer token in test code
  - [ ] npm test exits 0 (static + unit + eval all pass; integration skipped)

  ## Integration test rewrite pattern
  Old (insecure — reads token file directly):
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    token = tokens.access_token;
    execSync(`curl -s -H "Authorization: Bearer ${token}" ...`)

  New (secure — token handled by proxy):
    const result = execSync('python3 scripts/graph_call.py GET "/me"', {encoding:'utf8'});
    const response = JSON.parse(result);
    assert.strictEqual(response.status, 200);
    assert.ok(response.data.displayName);

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-501 — unit tests annotated, smoke test rewritten for graph_call.py"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 501 updates the unit and integration tests. Unit tests for the deprecated Node.js auth scripts get deprecation annotations but continue to run (the scripts still exist). The integration smoke test is rewritten to use `python3 scripts/graph_call.py` — removing the last place in the codebase that reads `~/.outlook-mcp-tokens.json` and injects a raw Bearer token.

## Success Criteria
- ✓ `test/unit/auth-server.test.js` and `token-refresh.test.js` both annotated with DEPRECATED; both still pass
- ✓ `test/integration/smoke.test.js` has zero references to `~/.outlook-mcp-tokens.json` or `access_token`
- ✓ `npm test` exits 0

## Skills Required

### Specific:
- Pattern: follow existing test file structure; use `node:test` + `node:assert`

## Dependencies
### Must Complete Before
- ralph-loop-500: security and API structure tests must exist first

## Complexity
**Scope**: Low — annotation + targeted rewrite of smoke test

---
---
loop: ralph-loop-502
name: Project Files and Final Verification
task_name: Project Files and Final Verification
max_iterations: 6
on_max_iterations: escalate
handoff_summary:
  done: "Updated CLAUDE.md with security architecture section and graph_call.py conventions; added .gitignore entries; deprecated old Node.js scripts; removed curl-structure.test.js; npm test passes all suites; final security scan clean."
  failed: ""
  needed: "Programme complete. All phases 1-5 delivered."
todos:
  - id: "502-1"
    content: "Read CLAUDE.md and update: (1) replace 'Token is read with python3 -c' convention with graph_call.py proxy pattern description, (2) update Setup section to reference outlook-skills/auth.sh instead of .env and outlook-auth-server.js, (3) add a Security Architecture section describing encrypted tokens at rest, OS keychain, and graph_call.py as the only token interface, (4) remove ~/.outlook-mcp-tokens.json from all references, (5) update Environment Variables table to remove OUTLOOK_CLIENT_SECRET (now in keychain)"
    skill: "NA"
    agent: "worker"
    outcome: "CLAUDE.md references graph_call.py as the API call mechanism; contains Security Architecture section; zero references to ~/.outlook-mcp-tokens.json or 'Token is read with python3 -c'; Setup section references auth.sh"
    status: completed
    priority: high
  - id: "502-2"
    content: "Read .gitignore and add two entries if not already present: 'outlook-skills/.venv/' and '*.enc'"
    skill: "NA"
    agent: "worker"
    outcome: ".gitignore contains outlook-skills/.venv/ and *.enc entries"
    status: completed
    priority: high
  - id: "502-3"
    content: "Read package.json and verify test:security script is present (added in loop 500); also check that the existing test scripts still reference the correct test file paths; add a note comment in the scripts section if helpful"
    skill: "NA"
    agent: "worker"
    outcome: "package.json test:security script is present; all test script paths are correct and functional"
    status: completed
    priority: high
  - id: "502-4"
    content: "Read scripts/outlook-auth-server.js and add a DEPRECATED header comment at the very top of the file (before any existing code): '// DEPRECATED: This Node.js OAuth server has been replaced by outlook-skills/auth.sh (Python). // This file is retained for reference only. Do not use in new workflows.'"
    skill: "NA"
    agent: "worker"
    outcome: "scripts/outlook-auth-server.js first lines contain the DEPRECATED comment; file functionality is otherwise unchanged"
    status: completed
    priority: high
  - id: "502-5"
    content: "Read scripts/outlook-token-refresh.js and add the same DEPRECATED header comment at the top: '// DEPRECATED: Token refresh is now handled internally by outlook-skills/token_helper.py via graph_call.py. // This file is retained for reference only. Do not use in new workflows.'"
    skill: "NA"
    agent: "worker"
    outcome: "scripts/outlook-token-refresh.js first lines contain the DEPRECATED comment; file functionality is otherwise unchanged"
    status: completed
    priority: high
  - id: "502-6"
    content: "Run the full test suite: npm test (runs static + unit + eval). Report pass/fail counts. If anything fails that was passing before this phase, investigate and fix."
    skill: "NA"
    agent: "worker"
    outcome: "npm test exits 0; all static, unit, and eval suites pass; no regressions from Phase 5 changes"
    status: completed
    priority: high
  - id: "502-7"
    content: "Final security scan: grep -r 'outlook-mcp-tokens.json' . --include='*.md' --include='*.js' --include='*.py' --include='*.sh' (excluding node_modules and .git); grep -r 'Authorization: Bearer' . --include='*.md' (excluding node_modules). Report any matches found outside of deprecated scripts and test fixtures."
    skill: "NA"
    agent: "worker"
    outcome: "Zero outlook-mcp-tokens.json references in non-deprecated files; zero 'Authorization: Bearer' in any SKILL.md; any matches found are in deprecated scripts only (acceptable)"
    status: completed
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Update CLAUDE.md with the new security architecture, update .gitignore, verify package.json, add DEPRECATED headers to old Node.js scripts, run the full test suite, and complete the final security scan.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-502"

  ## Success criteria
  - [ ] CLAUDE.md: graph_call.py as API pattern; Security Architecture section present; no ~/.outlook-mcp-tokens.json refs
  - [ ] .gitignore: outlook-skills/.venv/ and *.enc present
  - [ ] package.json: test:security script confirmed present
  - [ ] scripts/outlook-auth-server.js: DEPRECATED header at top
  - [ ] scripts/outlook-token-refresh.js: DEPRECATED header at top
  - [ ] npm test exits 0 (all suites pass)
  - [ ] Final grep scan: no outlook-mcp-tokens.json in non-deprecated files

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-502 — CLAUDE.md updated, deprecated scripts marked, Phase 5 complete"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 502 is the final loop of the entire programme. It updates project-level files (CLAUDE.md, .gitignore, package.json), adds deprecation headers to the now-superseded Node.js auth scripts, runs the full test suite for a final pass, and executes a comprehensive security scan to confirm no token patterns survive anywhere in the codebase.

## Success Criteria
- ✓ `CLAUDE.md` references `graph_call.py`; no `~/.outlook-mcp-tokens.json`; Security Architecture section present
- ✓ `.gitignore` contains `outlook-skills/.venv/` and `*.enc`
- ✓ `scripts/outlook-auth-server.js` and `scripts/outlook-token-refresh.js` have DEPRECATED headers
- ✓ `npm test` exits 0
- ✓ Final grep scan: zero `outlook-mcp-tokens.json` references outside deprecated scripts

## Skills Required

### Specific:
- `outlook-base`: Reference for what CLAUDE.md should describe as the new API call pattern

## Dependencies
### Must Complete Before
- ralph-loop-501: all tests updated

## Complexity
**Scope**: Low-Medium — mostly file updates; CLAUDE.md requires careful rewriting
