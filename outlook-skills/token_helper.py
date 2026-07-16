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

import json
import os
import sys
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

# Load .env so client_secret is available for silent token refresh
try:
    from dotenv import load_dotenv
    load_dotenv(_SCRIPT_DIR / ".env")
except ImportError:
    pass  # dotenv not installed yet (first-run before bootstrap); refresh will fail gracefully


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


def _save_tokens(tokens: dict):
    """Persist updated tokens (atomic write)."""
    tmp = TOKEN_FILE.parent / (TOKEN_FILE.name + ".tmp")
    tmp.write_text(json.dumps(tokens, indent=2))
    tmp.replace(TOKEN_FILE)
    if sys.platform == "win32":
        import subprocess
        import getpass
        result = subprocess.run(
            ["icacls", str(TOKEN_FILE), "/inheritance:r", "/grant:r", f"{getpass.getuser()}:(R,W)"],
            capture_output=True
        )
        if result.returncode != 0:
            pass  # Non-fatal; ACL failure does not break token use
    else:
        TOKEN_FILE.chmod(0o600)


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


def get_token() -> str:
    """
    Return a valid Bearer access token.

    Transparently handles:
      - Loading from local token store
      - Silent refresh when access token is expired
      - 30-day session enforcement

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
    if time.time() < tokens.get("access_token_expires_at", 0):
        return tokens["access_token"]

    # ── Silently refresh ──────────────────────────────────────────────────────
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
