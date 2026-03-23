#!/usr/bin/env python3
"""
azure-auth/auth_runner.py

Handles the Azure OAuth 2.0 Authorization Code flow:
  - Launches browser for user login and consent
  - Spins up a temporary local HTTP server to catch the callback
  - Stores tokens in outlook-skills/tokens.json (gitignored, plain JSON)

Credentials are loaded from outlook-skills/.env:
  OUTLOOK_CLIENT_ID=...
  OUTLOOK_CLIENT_SECRET=...
  OUTLOOK_TENANT_ID=...   (defaults to "common")

Usage (via auth.sh or auth.ps1 — do not call directly):
  auth.sh                  First-time setup or re-check
  auth.sh --reauth         Force new browser login (clears existing session)
  auth.sh --revoke         Revoke and delete all stored tokens
  auth.sh --status         Show current auth status without modifying anything
"""

import argparse
import base64
import hmac
import http.server
import json
import os
import secrets
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path


# ── Optional dependency guard ─────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
except ImportError as e:
    print(f"[error] Missing dependency: {e}")
    print("        Run auth.sh (or auth.ps1) to auto-install dependencies.")
    sys.exit(1)


# ── Constants ─────────────────────────────────────────────────────────────────
_SCRIPT_DIR = Path(__file__).parent
TOKEN_FILE  = _SCRIPT_DIR / "tokens.json"

load_dotenv(_SCRIPT_DIR / ".env")

CLIENT_ID     = os.environ.get("OUTLOOK_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("OUTLOOK_CLIENT_SECRET", "")
TENANT_ID     = os.environ.get("OUTLOOK_TENANT_ID", "common")

REDIRECT_PORT   = 8400
REDIRECT_URI    = f"http://localhost:{REDIRECT_PORT}/callback"
MAX_SESSION_AGE = 30 * 24 * 60 * 60   # 30 days

# Scope catalogue — maps friendly names to Microsoft Graph scopes
SCOPE_CATALOGUE = {
    "mail_read":     "Mail.Read",
    "mail_write":    "Mail.ReadWrite",
    "mail_send":     "Mail.Send",
    "calendar_read": "Calendars.Read",
    "calendar_write":"Calendars.ReadWrite",
    "user_profile":  "User.Read",
    "contacts_read": "Contacts.Read",
    "contacts_write":"Contacts.ReadWrite",
}

BASE_SCOPES = ["openid", "profile", "email", "offline_access"]

DEFAULT_PERMISSIONS = [
    "mail_read", "mail_write", "mail_send", "calendar_read", "calendar_write",
    "user_profile", "contacts_read", "contacts_write"
]


# ── Token store ───────────────────────────────────────────────────────────────

def load_tokens() -> dict:
    """Load token store from disk. Returns empty dict if not found."""
    if not TOKEN_FILE.exists():
        return {}
    try:
        return json.loads(TOKEN_FILE.read_text())
    except Exception:
        return {}


def save_tokens(tokens: dict):
    """Persist token store as plain JSON (atomic write)."""
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
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
            print("  [warn] Could not set restrictive ACL on tokens.json")
    else:
        TOKEN_FILE.chmod(0o600)


def delete_tokens():
    """Remove token file."""
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()


# ── Scope builder ─────────────────────────────────────────────────────────────

def build_scopes(permissions: list[str]) -> list[str]:
    """Map permission names to Graph scopes, always including base scopes."""
    scopes = BASE_SCOPES.copy()
    for perm in permissions:
        if perm not in SCOPE_CATALOGUE:
            raise ValueError(f"Unknown permission: '{perm}'. "
                             f"Valid options: {list(SCOPE_CATALOGUE.keys())}")
        scopes.append(SCOPE_CATALOGUE[perm])
    return scopes


# ── Auth URL builder ──────────────────────────────────────────────────────────

def build_auth_url(tenant_id: str, client_id: str,
                   scopes: list[str], state: str) -> str:
    """Construct the Azure AD authorisation URL."""
    params = {
        "client_id":     client_id,
        "response_type": "code",
        "redirect_uri":  REDIRECT_URI,
        "response_mode": "query",
        "scope":         " ".join(scopes),
        "state":         state,
        "prompt":        "select_account",
    }
    base = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize"
    return f"{base}?{urllib.parse.urlencode(params)}"


# ── Local callback server ─────────────────────────────────────────────────────

class CallbackHandler(http.server.BaseHTTPRequestHandler):
    """Minimal HTTP handler — catches the OAuth redirect, extracts the code."""

    result: dict = {}

    def do_GET(self):
        # Ignore browser prefetches (favicon, etc.)
        if not self.path.startswith("/callback"):
            self.send_response(404)
            self.end_headers()
            return

        parsed = urllib.parse.urlparse(self.path)
        params = dict(urllib.parse.parse_qsl(parsed.query))

        if "code" in params:
            CallbackHandler.result = {"code": params["code"], "state": params.get("state", "")}
            body = b"<html><body><h2>Authentication successful.</h2><p>You may close this tab.</p></body></html>"
            self.send_response(200)
        elif "error" in params:
            CallbackHandler.result = {"error": params.get("error"), "description": params.get("error_description", ""), "state": params.get("state", "")}
            body = b"<html><body><h2>Authentication failed.</h2><p>Check the terminal for details.</p></body></html>"
            self.send_response(400)
        else:
            self.send_response(404)
            body = b""

        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def wait_for_callback(state: str, timeout: int = 120) -> dict:
    """Start local server, wait for OAuth redirect, return result."""
    try:
        server = http.server.HTTPServer(("localhost", REDIRECT_PORT), CallbackHandler)
    except OSError as e:
        print(f"\n  [error] Port {REDIRECT_PORT} is already in use.")
        print(f"          Is another auth process running? ({e})")
        sys.exit(1)
    CallbackHandler.result = {}

    def serve():
        while not CallbackHandler.result:
            server.handle_request()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    thread.join(timeout=timeout)
    server.server_close()

    if not CallbackHandler.result:
        raise TimeoutError(f"No callback received within {timeout} seconds.")

    return CallbackHandler.result


# ── Token exchange ────────────────────────────────────────────────────────────

def exchange_code(tenant_id: str, client_id: str, client_secret: str,
                  code: str) -> dict:
    """Exchange authorisation code for access + refresh tokens."""
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

    payload = urllib.parse.urlencode({
        "client_id":     client_id,
        "client_secret": client_secret,
        "grant_type":    "authorization_code",
        "code":          code,
        "redirect_uri":  REDIRECT_URI,
    }).encode()

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def decode_id_token_email(id_token: str) -> str:
    """Extract email/upn from JWT id_token without verifying signature."""
    try:
        payload = id_token.split(".")[1]
        payload += "=" * (4 - len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return claims.get("email") or claims.get("upn") or claims.get("preferred_username", "unknown")
    except Exception:
        return "unknown"


# ── Main auth flow ────────────────────────────────────────────────────────────

def do_auth(permissions: list[str], force: bool = False):
    """Run the full OAuth flow."""
    if not CLIENT_ID or not CLIENT_SECRET:
        print("[error] OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET must be set in outlook-skills/.env")
        print("        Copy outlook-skills/.env.example to outlook-skills/.env and fill in your Azure app credentials.")
        sys.exit(1)

    # Check existing session
    if not force:
        tokens = load_tokens()
        if tokens:
            age = time.time() - tokens.get("session_started_at", 0)
            if age < MAX_SESSION_AGE:
                days_left = int((MAX_SESSION_AGE - age) / 86400)
                email = tokens.get("user_email", "unknown")
                print(f"\n  Already authenticated as {email}")
                print(f"    Session valid for ~{days_left} more days.")
                print(f"    Use --reauth to force a new login.\n")
                return
            else:
                print("  Session has expired (>30 days). Starting re-authentication...\n")

    scopes   = build_scopes(permissions)
    state    = secrets.token_urlsafe(32)

    auth_url = build_auth_url(TENANT_ID, CLIENT_ID, scopes, state)

    print("  Opening browser for Microsoft login...")
    print(f"  Requested permissions: {', '.join(permissions)}")
    print()
    print("  If the browser doesn't open, paste this URL manually:")
    print(f"  {auth_url}\n")

    webbrowser.open(auth_url)

    print("  Waiting for authentication... (2 minute timeout)")
    try:
        result = wait_for_callback(state, timeout=120)
    except TimeoutError:
        print("\n  [error] Timed out. Please run auth.sh again.")
        sys.exit(1)

    # Validate state before acting on any response (prevents CSRF)
    if not hmac.compare_digest(result.get("state", ""), state):
        print("\n  [error] State mismatch — possible CSRF. Aborting.")
        sys.exit(1)

    if "error" in result:
        print(f"\n  [error] Auth failed: {result['error']}")
        print(f"          {result.get('description', '')}")
        sys.exit(1)

    print("  Login successful. Exchanging code for tokens...")

    token_response = exchange_code(TENANT_ID, CLIENT_ID, CLIENT_SECRET,
                                   result["code"])

    email = decode_id_token_email(token_response.get("id_token", ""))

    tokens = {
        "access_token":            token_response["access_token"],
        "refresh_token":           token_response["refresh_token"],
        "access_token_expires_at": time.time() + token_response.get("expires_in", 3600) - 60,
        "session_started_at":      time.time(),
        "scopes":                  token_response.get("scope", "").split(),
        "user_email":              email,
        "tenant_id":               TENANT_ID,
        "client_id":               CLIENT_ID,
        # client_secret is NOT stored here — token_helper reads it from .env at refresh time
    }

    save_tokens(tokens)

    print(f"\n  Authenticated as: {email}")
    print(f"    Scopes granted: {', '.join(tokens['scopes'])}")
    print(f"    Tokens stored at: {TOKEN_FILE}")
    print(f"    Session will expire in 30 days.\n")


def do_status():
    """Print current auth status."""
    tokens = load_tokens()
    if not tokens:
        print("\n  Not authenticated. Run auth.sh (or auth.ps1) to set up.\n")
        return

    age       = time.time() - tokens.get("session_started_at", 0)
    days_used = int(age / 86400)
    days_left = max(0, int((MAX_SESSION_AGE - age) / 86400))
    token_exp = tokens.get("access_token_expires_at", 0)
    token_ok  = time.time() < token_exp

    print(f"\n  User:          {tokens.get('user_email', 'unknown')}")
    print(f"  Session age:   {days_used} days used, ~{days_left} days remaining")
    print(f"  Access token:  {'valid' if token_ok else 'expired (will auto-refresh)'}")
    print(f"  Scopes:        {', '.join(tokens.get('scopes', []))}")
    if os.environ.get("OUTLOOK_VERBOSE"):
        print(f"  Token file:    {TOKEN_FILE}")
    print()


def do_revoke():
    """Revoke and delete all stored tokens."""
    tokens = load_tokens()
    if not tokens:
        print("\n  No stored tokens to revoke.\n")
        return

    email = tokens.get("user_email", "unknown")
    delete_tokens()
    print(f"\n  Tokens for {email} have been revoked and deleted.\n")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Azure OAuth skill authentication")
    parser.add_argument("--reauth", action="store_true", help="Force new browser login")
    parser.add_argument("--revoke", action="store_true", help="Delete all stored tokens")
    parser.add_argument("--status", action="store_true", help="Show auth status")
    parser.add_argument("--scopes", nargs="*", default=DEFAULT_PERMISSIONS,
                        help=f"Permissions to request. Options: {list(SCOPE_CATALOGUE.keys())}")
    args = parser.parse_args()

    if args.revoke:
        do_revoke()
    elif args.status:
        do_status()
    else:
        do_auth(args.scopes, force=args.reauth)


if __name__ == "__main__":
    main()
