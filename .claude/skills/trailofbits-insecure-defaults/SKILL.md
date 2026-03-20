---
name: trailofbits-insecure-defaults
description: "Trail of Bits insecure defaults audit — scan a codebase for security-insecure default behaviors, missing hardening, weak cryptographic choices, and dangerous API usage that could be exploited by an attacker. Trigger when user wants to audit for insecure defaults or weak configurations."
user_invocable: true
---

# Trail of Bits Insecure Defaults Audit

Scan for security-insecure defaults and hardening gaps. Focus on behaviors that are dangerous by default even when not obviously "wrong".

## Scope & Checks

### Authentication & Tokens
- Token/credential handling: are secrets ever logged, printed to stderr, stored in world-readable files, or leaked in error messages?
- JWT handling: signature verification skipped? Unsigned claims used for authorization decisions?
- CSRF protection: state parameter compared with `!=` (timing-safe?) vs `hmac.compare_digest`?
- Session expiry: is stale session wiping done securely (in-memory bytes zeroed)?

### Cryptography
- Fernet/AES key storage: is the encryption key itself protected?
- Random number generation: `secrets` module or `os.urandom` (good) vs `random` module (bad for security)?
- PKCE: S256 challenge method used? Verifier of sufficient entropy?

### Network & API
- URL construction: user-controlled segments concatenated into URLs without allowlist validation?
- TLS: `verify=False` or custom `ssl.SSLContext` with verification disabled?
- Timeouts: missing request timeouts (can hang indefinitely)?

### File System
- File permissions: sensitive files (tokens, keys, config) created with default umask?
- Temp files: `tempfile.mktemp()` (insecure) vs `tempfile.mkstemp()`?
- Path traversal: user-supplied paths used in file operations without normalization?

### Shell & Subprocess
- `shell=True` in subprocess calls?
- Unescaped variable interpolation into shell strings?
- `eval`/`exec` with any external input?

## Output Format

For each finding:
- **Location**: file:line
- **Issue**: what is wrong and why it is insecure by default
- **Risk**: what an attacker can achieve
- **Fix**: concrete code change
- **Severity**: High / Medium / Low / Info

List confirmed-clean checks explicitly.
