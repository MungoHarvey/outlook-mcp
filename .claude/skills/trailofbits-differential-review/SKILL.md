---
name: trailofbits-differential-review
description: "Trail of Bits differential security review — analyze a diff or set of changed files for security vulnerabilities introduced between two revisions. Scope review to the changed code. Trigger when user wants to review a PR, diff, or branch for security issues."
user_invocable: true
---

# Trail of Bits Differential Security Review

Perform a focused security review of code changes (diff scope only). Do not rehash unchanged baseline code unless it is directly relevant to a vulnerability in the diff.

## Workflow

1. **Establish diff scope** — identify the set of changed files and the nature of each change (new file, modified logic, dependency update, config change).

2. **Classify each change** — for each changed file, note: is this a security-relevant surface? (input handling, auth, crypto, shell commands, file I/O, network, subprocess, template rendering, deserialization)

3. **Apply focused checks per change type**:
   - **Shell scripts**: variable injection, unquoted expansions, `sed`/`awk` replacement sanitization, command injection via interpolated variables
   - **PowerShell scripts**: `-replace` regex backreference injection (`$1`, `$0`), string interpolation in replacement positions, `Invoke-Expression` use
   - **Python**: `subprocess` shell=True, `eval`/`exec`, path traversal, format string injection, insecure deserialization
   - **Config/installer scripts**: hardcoded credentials, world-readable files created, PATH manipulation, privilege escalation via sudo

4. **Report each finding** with:
   - Location (file:line)
   - Vulnerability class
   - Concrete exploit scenario
   - Recommended fix (specific code)
   - Severity: High / Medium / Low / Info

5. **Explicitly confirm** what was checked and found to be clean (reduces false-negative risk).
