#!/usr/bin/env python3
"""
_shared/token_helper.py

The single point of truth for token access across all skills.
Every skill imports this module — none of them handle auth directly.

Usage:
    from skills._shared.token_helper import get_token, AuthRequiredError

    try:
        token = get_token()
    except AuthRequiredError as e:
        print(f"Please run: bash outlook-skills/auth.sh\\n{e}")

The helper:
  - Loads tokens from outlook-skills/tokens.json (plain JSON, gitignored)
  - Returns a valid access token, refreshing silently if expired
  - Raises AuthRequiredError if the 30-day session has expired or no tokens exist
"""

import contextlib
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


# ── Constants ─────────────────────────────────────────────────────────────────
_SCRIPT_DIR     = Path(__file__).parent
TOKEN_FILE      = _SCRIPT_DIR / "tokens.json"
SCOPES_FILE     = _SCRIPT_DIR / "scopes.json"
MAX_SESSION_AGE = 30 * 24 * 60 * 60   # 30 days

# OIDC + offline_access are not echoed as Graph resource scopes in the token
# response, so they are excluded from scope-drift comparison.
_OIDC_SCOPES = {"openid", "profile", "email", "offline_access"}

# Load .env so client_secret is available for silent token refresh.
# Dependency-free parser (mirrors auth-server.js loadEnv) — refresh must not
# depend on python-dotenv being installed, since the install flow never
# guarantees it.
def _load_env_file(path):
    """Parse KEY=VALUE lines from a .env file into os.environ.

    .env takes precedence over a pre-set environment variable, matching
    auth-server.js (`env.X || process.env.X`) so every auth path agrees on the
    credential source — otherwise a stale exported OUTLOOK_CLIENT_SECRET could
    make refresh use a different secret than the one auth signed in with.
    """
    try:
        lines = Path(path).read_text().splitlines()
    except OSError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        os.environ[key] = val


_load_env_file(_SCRIPT_DIR / ".env")


# ── Exceptions ────────────────────────────────────────────────────────────────

class AuthRequiredError(Exception):
    """
    Raised when full re-authentication is needed.
    Calling skill should prompt the user to run auth.sh.
    """
    pass


class TokenRefreshError(Exception):
    """Raised when token refresh fails for a recoverable reason."""
    pass


# ── Internal: load + save ─────────────────────────────────────────────────────

def _load_tokens() -> dict:
    """Load tokens from disk."""
    if not TOKEN_FILE.exists():
        raise AuthRequiredError(
            "No token file found. Run: bash outlook-skills/auth.sh"
        )
    try:
        return json.loads(TOKEN_FILE.read_text())
    except Exception as e:
        raise AuthRequiredError(
            f"Could not read token store ({e}). "
            "Run: bash outlook-skills/auth.sh --reauth"
        )


def _harden_perms(path):
    """Restrict a file to the current user (best-effort; non-fatal on failure)."""
    try:
        if sys.platform == "win32":
            import subprocess
            import getpass
            subprocess.run(
                ["icacls", str(path), "/inheritance:r", "/grant:r",
                 f"{getpass.getuser()}:(R,W)"],
                capture_output=True,
            )
        else:
            Path(path).chmod(0o600)
    except Exception:
        pass  # ACL/chmod failure does not break token use


LOCK_FILE = _SCRIPT_DIR / "tokens.json.lock"
STALE_LOCK_SECS = 60  # reclaim a lock older than this (> the 30s refresh timeout)


@contextlib.contextmanager
def _refresh_lock(timeout=10.0, poll=0.1):
    """Best-effort advisory lock so two processes don't refresh concurrently
    and corrupt the token store. Falls through (unlocked) on timeout rather
    than deadlocking."""
    fd = None
    deadline = time.time() + timeout
    while True:
        try:
            fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except (FileExistsError, PermissionError):
            # FileExistsError = held; PermissionError = Windows transient during a
            # concurrent create/unlink of the lock file. Both mean "retry".
            # Reclaim an ORPHANED lock (owner crashed mid-refresh) so it can't
            # impose the full timeout on every subsequent refresh forever.
            try:
                if time.time() - os.path.getmtime(str(LOCK_FILE)) > STALE_LOCK_SECS:
                    os.unlink(str(LOCK_FILE))
                    continue
            except OSError:
                pass
            if time.time() >= deadline:
                break  # contended — proceed best-effort
            time.sleep(poll)
    try:
        yield
    finally:
        if fd is not None:
            os.close(fd)
            try:
                os.unlink(str(LOCK_FILE))
            except OSError:
                pass


def _save_tokens(tokens: dict):
    """Persist updated tokens atomically, with restrictive permissions and a
    unique temp file so concurrent writers never clobber a shared tmp."""
    fd, tmpname = tempfile.mkstemp(dir=str(TOKEN_FILE.parent),
                                   prefix=TOKEN_FILE.name + ".", suffix=".tmp")
    tmp = Path(tmpname)
    try:
        with os.fdopen(fd, "w") as f:
            f.write(json.dumps(tokens, indent=2))
        _harden_perms(tmp)      # tighten before it becomes the live token file
        # On Windows, os.replace can transiently fail (WinError 5) when another
        # process/thread is replacing the same target — retry briefly.
        for attempt in range(5):
            try:
                tmp.replace(TOKEN_FILE)
                break
            except PermissionError:
                if attempt == 4:
                    # Transient/contended write — surface as a retryable refresh
                    # error (→ 503) rather than an opaque 500 internal_error.
                    raise TokenRefreshError(
                        "Could not write the token store (file busy). Please retry.")
                time.sleep(0.02)
        _harden_perms(TOKEN_FILE)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


# ── Internal: token refresh ───────────────────────────────────────────────────

def _refresh_access_token(tokens: dict) -> dict:
    """
    Use the refresh token to obtain a new access token.
    Returns updated token dict.
    Raises AuthRequiredError if refresh is rejected.
    """
    tenant_id     = tokens.get("tenant_id", "")
    client_id     = tokens.get("client_id", "")
    client_secret = tokens.get("client_secret", "") or os.environ.get("OUTLOOK_CLIENT_SECRET", "")

    if not client_secret:
        raise AuthRequiredError(
            "client_secret not found in token store or environment. "
            "Run: bash outlook-skills/auth.sh --reauth"
        )

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise AuthRequiredError(
            "No refresh_token found in token store. "
            "Run: bash outlook-skills/auth.sh --reauth"
        )

    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

    payload = urllib.parse.urlencode({
        "client_id":     client_id,
        "client_secret": client_secret,
        "grant_type":    "refresh_token",
        "refresh_token": refresh_token,
    }).encode()

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        error_data = {}
        try:
            error_data = json.loads(body)
        except Exception:
            pass

        error_code = error_data.get("error", "")
        if error_code in ("invalid_grant", "interaction_required", "consent_required"):
            raise AuthRequiredError(
                f"Refresh token rejected ({error_code}). "
                "Run: bash outlook-skills/auth.sh --reauth"
            )
        raise TokenRefreshError(f"Token refresh failed: {error_code} — {body}")
    except urllib.error.URLError as e:
        # Network failure / timeout — transient, not a re-auth condition.
        raise TokenRefreshError(f"Network error during token refresh: {e.reason}")
    except TimeoutError as e:
        raise TokenRefreshError(f"Timeout during token refresh: {e}")

    # Update tokens — preserve session_started_at (enforces 30-day limit)
    tokens["access_token"]            = data["access_token"]
    tokens["access_token_expires_at"] = time.time() + data.get("expires_in", 3600) - 60

    # Azure may rotate the refresh token — always update if provided
    if "refresh_token" in data:
        tokens["refresh_token"] = data["refresh_token"]

    return tokens


# ── Public API ────────────────────────────────────────────────────────────────

def _required_graph_scopes() -> list:
    """Graph resource scopes (excluding OIDC/offline_access) skills need."""
    try:
        data = json.loads(SCOPES_FILE.read_text())
        return [s for s in data.get("scopes", []) if s.lower() not in _OIDC_SCOPES]
    except Exception:
        return []


def missing_scopes(tokens: dict = None) -> list:
    """Return required Graph scopes absent from the stored grant.

    A non-empty result means the token was minted before a scope was added —
    the user must run auth with --reauth to consent to the new permissions;
    a silent refresh cannot acquire them.
    """
    if tokens is None:
        try:
            tokens = _load_tokens()
        except AuthRequiredError:
            return []
    granted = [s.lower() for s in tokens.get("scopes", [])]
    out = []
    for req in _required_graph_scopes():
        rl = req.lower()
        if not any(g == rl or g.endswith("/" + rl) for g in granted):
            out.append(req)
    return out


def get_token(force_refresh: bool = False) -> str:
    """
    Return a valid Bearer access token.

    Transparently handles:
      - Loading from local token store
      - Silent refresh when access token is expired
      - 30-day session enforcement

    force_refresh=True bypasses the local-expiry short-circuit and refreshes
    unconditionally — used by the 401 retry path, where the server has rejected
    a token that still looks unexpired locally (revocation, clock skew).

    Raises:
      AuthRequiredError  — if setup or re-authentication is needed
      TokenRefreshError  — if refresh fails for a transient reason
    """
    tokens = _load_tokens()

    # ── 30-day session check ──────────────────────────────────────────────────
    session_age = time.time() - tokens.get("session_started_at", 0)
    if session_age > MAX_SESSION_AGE:
        _save_tokens({})
        raise AuthRequiredError(
            "Session has expired (30-day limit). "
            "Run: bash outlook-skills/auth.sh --reauth"
        )

    # ── Access token still valid ──────────────────────────────────────────────
    if not force_refresh and time.time() < tokens.get("access_token_expires_at", 0):
        return tokens["access_token"]

    # ── Silently refresh (locked; re-check expiry after acquiring) ────────────
    with _refresh_lock():
        tokens = _load_tokens()  # another process may have refreshed meanwhile
        if not force_refresh and time.time() < tokens.get("access_token_expires_at", 0):
            return tokens["access_token"]
        updated = _refresh_access_token(tokens)
        _save_tokens(updated)
        return updated["access_token"]


def get_session_info() -> dict:
    """
    Return human-readable session metadata (no tokens).
    Useful for skill status checks.
    """
    try:
        tokens = _load_tokens()
    except AuthRequiredError:
        return {"authenticated": False}

    age       = time.time() - tokens.get("session_started_at", 0)
    days_left = max(0, int((MAX_SESSION_AGE - age) / 86400))

    return {
        "authenticated":  True,
        "user_email":     tokens.get("user_email", "unknown"),
        "days_remaining": days_left,
        "scopes":         tokens.get("scopes", []),
        "missing_scopes": missing_scopes(tokens),
        "token_valid":    time.time() < tokens.get("access_token_expires_at", 0),
    }
