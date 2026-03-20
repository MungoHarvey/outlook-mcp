---
loop: ralph-loop-200
name: Build graph_call.py Core
task_name: Build graph_call.py Core
max_iterations: 6
on_max_iterations: escalate
handoff_summary:
  done: "Created scripts/graph_call.py with argparse CLI, venv bootstrap, token_helper integration, urllib HTTP methods (GET/POST/PATCH/DELETE/PUT), and structured JSON output format. All 7 todos completed. Verified: --help works, syntax valid, zero token print patterns."
  failed: ""
  needed: "Loop 201 should add traceback suppression, 401 auto-retry with exponential backoff, and cross-platform Windows/POSIX venv path detection improvements."
todos:
  - id: "200-1"
    content: "Ensure scripts/ directory exists (create if not present)"
    skill: "NA"
    agent: "worker"
    outcome: "scripts/ directory exists in the project root"
    status: completed
    priority: high
  - id: "200-2"
    content: "Create scripts/graph_call.py with argparse CLI: positional args METHOD and endpoint, optional positional body, repeatable --header 'Key: Value' flag"
    skill: "NA"
    agent: "worker"
    outcome: "scripts/graph_call.py exists; running python3 scripts/graph_call.py --help shows METHOD, endpoint, body, and --header arguments"
    status: completed
    priority: high
  - id: "200-3"
    content: "Add venv bootstrap to graph_call.py: detect outlook-skills/.venv/ and insert the site-packages path into sys.path before any imports that need keyring/cryptography"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py contains a bootstrap block that calls sys.path.insert with the venv site-packages path before importing token_helper"
    status: completed
    priority: high
  - id: "200-4"
    content: "Add token acquisition to graph_call.py: import token_helper from outlook-skills/ via sys.path, call get_token(), handle AuthRequiredError by printing {\"status\": 401, \"error\": \"auth_required\", \"message\": \"Run: bash outlook-skills/auth.sh\"} and exiting"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py imports and calls token_helper.get_token(); AuthRequiredError produces correct structured JSON output and exits non-zero"
    status: completed
    priority: high
  - id: "200-5"
    content: "Add HTTP request execution to graph_call.py using urllib.request: build request with Authorization: Bearer header injected internally, support GET/POST/PATCH/DELETE methods, encode JSON body when provided, add --header values to request"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py can execute GET, POST, PATCH, DELETE requests to Graph API with Bearer auth and optional JSON body"
    status: completed
    priority: high
  - id: "200-6"
    content: "Add structured JSON output to graph_call.py: successful responses print {\"status\": HTTP_CODE, \"data\": PARSED_JSON}; 204 No Content prints {\"status\": 204, \"data\": null}; HTTP errors print {\"status\": CODE, \"error\": \"http_error\", \"message\": DETAIL}"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py stdout is always valid JSON matching {status, data} or {status, error, message} schema; no other text is printed to stdout"
    status: completed
    priority: high
  - id: "200-7"
    content: "Verify basic structure: python3 scripts/graph_call.py --help exits 0; python3 -c 'import ast; ast.parse(open(\"scripts/graph_call.py\").read())' exits 0 (syntax valid); grep confirms no print(.*token) pattern exists in the file"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py parses cleanly; --help works; zero print(.*token) matches in grep"
    status: completed
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Create scripts/graph_call.py — the CLI proxy that makes authenticated Graph API calls internally, returning only structured JSON to stdout, so the LLM never sees token values.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-200"

  ## Success criteria
  - [ ] scripts/graph_call.py exists and is syntactically valid Python
  - [ ] CLI interface: python3 scripts/graph_call.py METHOD "/endpoint" ['body'] [--header "K: V"]
  - [ ] Venv bootstrap adds outlook-skills/.venv/ site-packages to sys.path
  - [ ] token_helper.get_token() called internally — token never in any output
  - [ ] GET/POST/PATCH/DELETE all supported via urllib.request
  - [ ] Stdout is always valid JSON: {status, data} or {status, error, message}
  - [ ] 204 No Content returns {"status": 204, "data": null}
  - [ ] AuthRequiredError returns {"status": 401, "error": "auth_required", "message": "Run: bash outlook-skills/auth.sh"}
  - [ ] grep for print(.*token) returns zero matches

  ## Required skills
  - None (standard Python CLI development)

  ## Inputs
  - outlook-skills/token_helper.py — provides get_token() and AuthRequiredError
  - outlook-skills/outlook.py — reference for how token_helper is imported
  - Phase 2 plan: scripts/graph_call.py spec

  ## Expected outputs
  - scripts/graph_call.py — complete CLI proxy script

  ## Constraints
  - Use urllib.request only (no requests/httpx — zero new dependencies)
  - Token must NEVER appear in stdout, stderr, or any variable that could leak
  - No --verbose or debug mode that could expose token values
  - Argparse for CLI (not sys.argv manual parsing)
  - --header flag must be repeatable (action='append')

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-200 — scripts/graph_call.py core created"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 200 creates the core `scripts/graph_call.py` proxy script — the most critical security boundary in the project. This script accepts an HTTP method, endpoint, optional body, and optional headers from the LLM; internally acquires an OAuth token via `token_helper.get_token()`; makes the Graph API request; and returns only a structured JSON response. The token never appears in any output.

## Success Criteria
- ✓ `scripts/graph_call.py` exists and passes Python syntax check
- ✓ `python3 scripts/graph_call.py --help` shows all expected arguments
- ✓ `grep -n "print.*token" scripts/graph_call.py` returns zero matches
- ✓ Stdout is always valid JSON (`{"status": N, "data": ...}` or `{"status": N, "error": ..., "message": ...}`)
- ✓ All four HTTP methods (GET/POST/PATCH/DELETE) are implemented
- ✓ AuthRequiredError produces `{"status": 401, "error": "auth_required", "message": "Run: bash outlook-skills/auth.sh"}`

## Skills Required

### Broad (from phase plan):
- `python-development`: Building CLI tool with argparse, urllib, structured JSON output

### Specific (refined for this loop):
- Standard `argparse` + `urllib.request` — no specialist skill needed

### Discovered:
- None

## Inputs
| Input | Source | Format |
|-------|--------|--------|
| token_helper API | `outlook-skills/token_helper.py` | Python module |
| Graph API patterns | `outlook-skills/outlook.py` | Python reference |

## Outputs
| Output | Location | Format |
|--------|----------|--------|
| Graph proxy script | `scripts/graph_call.py` | Python |

## Dependencies

### Must Complete Before
- Phase 1 (ralph-loop-100, 101, 102): token_helper.py working with keychain; venv bootstrappable

### Blocked By
- Valid auth token not required for loop 200 (structural tests only; live API test in loop 201 is optional)

## Complexity
**Scope**: Medium
**Key challenges**:
1. Ensuring the token is never printed even in error/exception paths
2. Correctly constructing urllib.request objects for all HTTP methods with JSON bodies

---
---
loop: ralph-loop-201
name: Security Hardening and Cross-Platform
task_name: Security Hardening and Cross-Platform
max_iterations: 5
on_max_iterations: escalate
handoff_summary:
  done: "Hardened scripts/graph_call.py: added traceback suppression in main(), 401 auto-retry via recursive get_token(), Windows/POSIX venv path detection, venv_missing error, and fixed method guard."
  failed: ""
  needed: "Phase 2 complete. Phase 3 can now begin: migrate all SKILL.md files from TOKEN/curl to graph_call.py patterns."
todos:
  - id: "201-1"
    content: "Add traceback suppression to graph_call.py: wrap the entire main() body in a try/except BaseException block that catches all exceptions and prints {\"status\": 500, \"error\": \"internal_error\", \"message\": SAFE_MESSAGE} where SAFE_MESSAGE never includes local variable values that could contain tokens"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py main() is wrapped in try/except; unhandled exceptions produce structured JSON error output, not Python tracebacks"
    status: completed
    priority: high
  - id: "201-2"
    content: "Add 401 auto-retry to graph_call.py: on first 401 response, call token_helper.refresh_token() (or equivalent), then retry the request exactly once; if second attempt also returns 401, print {\"status\": 401, \"error\": \"auth_required\", \"message\": \"Run: bash outlook-skills/auth.sh\"} and exit"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py retries once on 401 using a refreshed token; a second consecutive 401 returns auth_required JSON without infinite loop"
    status: completed
    priority: high
  - id: "201-3"
    content: "Fix venv path detection for Windows: detect if running on Windows (sys.platform == 'win32') and use outlook-skills/.venv/Lib/site-packages; for POSIX use glob to find outlook-skills/.venv/lib/python3.*/site-packages"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py bootstrap block correctly finds venv site-packages on both Windows (Lib/site-packages) and Linux/Mac (lib/python3.X/site-packages)"
    status: completed
    priority: high
  - id: "201-4"
    content: "Add fallback for missing venv: if venv site-packages directory does not exist, print {\"status\": 500, \"error\": \"venv_missing\", \"message\": \"Run: bash outlook-skills/auth.sh to create venv\"} and exit rather than crashing with ImportError"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py exits with structured JSON error when venv is absent, not an ImportError traceback"
    status: completed
    priority: high
  - id: "201-5"
    content: "Add invalid method guard: if METHOD argument is not one of GET/POST/PATCH/DELETE/PUT, print {\"status\": 400, \"error\": \"invalid_method\", \"message\": \"Allowed: GET POST PATCH DELETE PUT\"} and exit"
    skill: "NA"
    agent: "worker"
    outcome: "graph_call.py returns structured JSON for unsupported HTTP methods rather than raising an exception"
    status: completed
    priority: high
  - id: "201-6"
    content: "Security scan: grep -n 'print.*token' scripts/graph_call.py; grep -n 'token' scripts/graph_call.py | grep -v '#' to review all token references and confirm none are in print/output statements; also check that sys.exc_info() or traceback.format_exc() are never used (which could expose local vars)"
    skill: "NA"
    agent: "worker"
    outcome: "Zero print(.*token) matches; all token variable references are in internal assignment or function calls only, never in output statements; no traceback.format_exc() calls"
    status: completed
    priority: high
  - id: "201-7"
    content: "Verify cross-platform path detection is present in the file: grep confirms both 'win32' and 'python3.' patterns exist in graph_call.py for the two venv path branches"
    skill: "NA"
    agent: "worker"
    outcome: "grep 'win32' scripts/graph_call.py returns at least one match; grep 'python3\\.' scripts/graph_call.py returns at least one match for POSIX path"
    status: completed
    priority: high
prompt: |
  ## Context from prior loop
  Done: [inject prior.handoff_summary.done]
  Failed: [inject prior.handoff_summary.failed]
  Needed: [inject prior.handoff_summary.needed]

  ## Objective
  Harden scripts/graph_call.py against token leakage via tracebacks and edge cases, add 401 auto-retry, and fix venv path detection for both Windows and POSIX platforms.

  ## Git checkpoint (run first)
  git add -A && git commit -m "checkpoint: before ralph-loop-201"

  ## Success criteria
  - [ ] All exceptions caught — no Python traceback ever reaches stdout
  - [ ] 401 auto-retry: refresh token + retry once; second 401 → auth_required JSON
  - [ ] Windows venv: outlook-skills/.venv/Lib/site-packages correctly detected
  - [ ] POSIX venv: outlook-skills/.venv/lib/python3.X/site-packages correctly detected via glob
  - [ ] Missing venv exits cleanly with structured JSON (not ImportError)
  - [ ] Invalid HTTP method exits cleanly with structured JSON
  - [ ] grep for print(.*token) returns zero matches
  - [ ] No traceback.format_exc() or sys.exc_info() calls (would leak local vars)

  ## Required skills
  - None (security hardening of existing Python script)

  ## Inputs
  - scripts/graph_call.py from loop 200
  - outlook-skills/token_helper.py — check what refresh function is available

  ## Expected outputs
  - scripts/graph_call.py — hardened, cross-platform, fully secure

  ## Constraints
  - Error messages must NEVER contain token values — use only fixed strings or HTTP status codes
  - Exception handler must strip all local variable context before outputting
  - Retry limit is exactly 1 — no infinite retry loops

  ## On completion
  1. git add -A && git commit -m "complete: ralph-loop-201 — graph_call.py security hardened and cross-platform"
  2. Update handoff_summary
  3. Mark all todos completed

  Begin. Mark todos in_progress before starting each task. One in_progress at a time.
---

## Overview

Loop 201 takes the functional `graph_call.py` from loop 200 and adds the security guarantees and platform support needed for production use: traceback suppression (critical — Python tracebacks can expose local variables including tokens), 401 auto-retry with a refresh cycle, correct Windows/POSIX venv path detection, and clean error handling for edge cases (missing venv, invalid method).

## Success Criteria
- ✓ All unhandled exceptions produce `{"status": 500, "error": "internal_error", ...}` — no tracebacks
- ✓ `grep -n "print.*token" scripts/graph_call.py` returns zero matches
- ✓ `grep "win32" scripts/graph_call.py` returns at least one match (Windows path branch)
- ✓ `grep "python3\." scripts/graph_call.py` returns at least one match (POSIX path branch)
- ✓ 401 retry logic: refresh + retry once; second 401 → auth_required without loop
- ✓ Missing venv: structured JSON error, not ImportError crash

## Skills Required

### Broad (from phase plan):
- `security-review`: Ensuring no token leakage in error paths, tracebacks, or edge cases
- `cross-platform`: Handling Windows vs POSIX venv paths

### Specific (refined for this loop):
- Exception handler design: stripping local variable context from error output

### Discovered:
- None

## Inputs
| Input | Source | Format |
|-------|--------|--------|
| graph_call.py core | `scripts/graph_call.py` (from loop 200) | Python |
| token_helper refresh API | `outlook-skills/token_helper.py` | Python module |

## Outputs
| Output | Location | Format |
|--------|----------|--------|
| Hardened proxy script | `scripts/graph_call.py` | Python |

## Dependencies

### Must Complete Before
- ralph-loop-200: graph_call.py core must exist

### Blocked By
- Valid auth token not strictly required (security scan is static analysis)

## Complexity
**Scope**: Medium
**Key challenges**:
1. Writing exception handlers that strip sensitive locals — Python's default traceback includes all local variable values
2. 401 retry: need to identify the correct token_helper refresh function and avoid double-retry
