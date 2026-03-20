#!/usr/bin/env python3
"""
azure-auth/auth_runner.py

Handles the full Azure OAuth 2.0 + PKCE flow:
  - Launches browser for user login and consent
  - Spins up a temporary local HTTP server to catch the callback
  - Stores encrypted tokens in ~/.skills/tokens.enc
  - Stores the encryption key in the OS keychain (never on disk)

Usage (via auth.sh — do not call directly):
  auth.sh                  First-time setup or re-check
  auth.sh --reauth         Force new browser login (clears existing session)
  auth.sh --revoke         Revoke and delete all stored tokens
  auth.sh --status         Show current auth status without modifying anything
"""

import argparse
import base64
import hashlib
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
    import keyring
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
except ImportError as e:
    print(f"[error] Missing dependency: {e}")
    print("        Run auth.sh to auto-install dependencies.")
    sys.exit(1)


# ── Constants ─────────────────────────────────────────────────────────────────
SKILLS_DIR       = Path.home() / ".skills"
CONFIG_FILE      = SKILLS_DIR / "config.json"
TOKEN_FILE       = SKILLS_DIR / "tokens.enc"
SALT_FILE        = SKILLS_DIR / "salt.bin"       # Non-secret; safe on disk

KEYCHAIN_SERVICE = "azure-skills-auth"
KEYCHAIN_USER    = "token-encryption-key"

REDIRECT_PORT    = 8400
REDIRECT_URI     = f"http://localhost:{REDIRECT_PORT}/callback"

# 30-day session enforcement (seconds)
MAX_SESSION_AGE  = 30 * 24 * 60 * 60

# Scope catalogue — maps friendly names to Microsoft Graph scopes
SCOPE_CATALOGUE = {
    "mail_read":        "Mail.Read",
    "mail_write":       "Mail.ReadWrite",
    "mail_send":        "Mail.Send",
    "calendar_read":    "Calendars.Read",
    "calendar_write":   "Calendars.ReadWrite",
    "user_profile":     "User.Read",
    "contacts_read":    "Contacts.Read",
}

# Base scopes always included
BASE_SCOPES = ["openid", "profile", "email", "offline_access"]

# Default scope set for this skill (Outlook + Calendar)
DEFAULT_PERMISSIONS = [
    "mail_read", "mail_write", "mail_send", "calendar_read", "calendar_write",
    "user_profile", "contacts_read"
]


# ── Keychain helpers ──────────────────────────────────────────────────────────

def get_or_create_encryption_key() -> bytes:
    """
    Retrieve encryption key from OS keychain, or generate and store a new one.
    The key is a 32-byte Fernet key, base64-encoded in the keychain.
    """
    existing = keyring.get_password(KEYCHAIN_SERVICE, KEYCHAIN_USER)
    if existing:
        return base64.urlsafe_b64decode(existing.encode())

    # First run — generate a new key
    key = Fernet.generate_key()
    keyring.set_password(KEYCHAIN_SERVICE, KEYCHAIN_USER, key.decode())
    return key


def delete_encryption_key():
    """Remove key from keychain (used during revoke)."""
    try:
        keyring.delete_password(KEYCHAIN_SERVICE, KEYCHAIN_USER)
    except keyring.errors.PasswordDeleteError:
        pass  # Already gone


# ── Client secret management ──────────────────────────────────────────────────

KEYCHAIN_CLIENT_SECRET_USER = "client-secret"

def get_or_retrieve_client_secret(config: dict) -> str:
    """
    Retrieve client_secret from OS keychain.
    If not in keychain:
      1. Check config dict (one-time migration from config.json)
      2. Prompt user interactively via getpass
    Stores the secret in keychain for future use.
    """
    # Try keychain first
    existing = keyring.get_password(KEYCHAIN_SERVICE, KEYCHAIN_CLIENT_SECRET_USER)
    if existing:
        return existing

    # One-time migration: if config.json still has client_secret, migrate it
    if config.get("client_secret"):
        secret = config["client_secret"]
        keyring.set_password(KEYCHAIN_SERVICE, KEYCHAIN_CLIENT_SECRET_USER, secret)
        print("  [migrated] client_secret moved from config.json to OS keychain.")
        print("  [info]     You can remove 'client_secret' from ~/.skills/config.json")
        return secret

    # Interactive prompt (first-time setup)
    import getpass
    print("\n  Client secret not found in keychain.")
    print("  Enter your Azure app client secret (it will be stored securely in the OS keychain):")
    secret = getpass.getpass("  client_secret: ")
    if not secret.strip():
        print("[error] Client secret cannot be empty.")
        import sys
        sys.exit(1)
    keyring.set_password(KEYCHAIN_SERVICE, KEYCHAIN_CLIENT_SECRET_USER, secret.strip())
    print("  ✓ client_secret stored in OS keychain.")
    return secret.strip()


# ── Token store ───────────────────────────────────────────────────────────────

def load_tokens() -> dict:
    """Decrypt and load token store. Returns empty dict if not found."""
    if not TOKEN_FILE.exists():
        return {}
    try:
        key  = get_or_create_encryption_key()
        f    = Fernet(key)
        data = f.decrypt(TOKEN_FILE.read_bytes())
        return json.loads(data)
    except Exception:
        return {}


def save_tokens(tokens: dict):
    """Encrypt and persist token store."""
    SKILLS_DIR.mkdir(mode=0o700, exist_ok=True)
    key  = get_or_create_encryption_key()
    f    = Fernet(key)
    data = f.encrypt(json.dumps(tokens).encode())
    TOKEN_FILE.write_bytes(data)
    TOKEN_FILE.chmod(0o600)  # Owner read/write only


def delete_tokens():
    """Remove token file and keychain entry."""
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()
    delete_encryption_key()


# ── PKCE helpers ──────────────────────────────────────────────────────────────

def generate_pkce() -> tuple[str, str]:
    """Generate PKCE code_verifier and code_challenge (S256)."""
    verifier  = secrets.token_urlsafe(96)
    digest    = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


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
                   scopes: list[str], state: str, code_challenge: str) -> str:
    """Construct the Azure AD authorisation URL."""
    params = {
        "client_id":             client_id,
        "response_type":         "code",
        "redirect_uri":          REDIRECT_URI,
        "response_mode":         "query",
        "scope":                 " ".join(scopes),
        "state":                 state,
        "code_challenge":        code_challenge,
        "code_challenge_method": "S256",
        "prompt":                "select_account",  # Always show account picker
    }
    base = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize"
    return f"{base}?{urllib.parse.urlencode(params)}"


# ── Local callback server ─────────────────────────────────────────────────────

class CallbackHandler(http.server.BaseHTTPRequestHandler):
    """Minimal HTTP handler — catches the OAuth redirect, extracts the code."""

    # Shared result across server and main thread
    result: dict = {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = dict(urllib.parse.parse_qsl(parsed.query))

        # Extract auth code or error
        if "code" in params:
            CallbackHandler.result = {"code": params["code"], "state": params.get("state", "")}
            body = b"<html><body><h2>Authentication successful.</h2><p>You may close this tab.</p></body></html>"
            self.send_response(200)
        elif "error" in params:
            CallbackHandler.result = {"error": params.get("error"), "description": params.get("error_description", "")}
            body = b"<html><body><h2>Authentication failed.</h2><p>Check the terminal for details.</p></body></html>"
            self.send_response(400)
        else:
            self.send_response(404)
            body = b""

        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # Suppress server access logs


def wait_for_callback(state: str, timeout: int = 120) -> dict:
    """
    Start local server, wait for OAuth redirect, return result.
    Raises TimeoutError if user doesn't complete auth within timeout seconds.
    """
    server = http.server.HTTPServer(("localhost", REDIRECT_PORT), CallbackHandler)
    CallbackHandler.result = {}

    def serve():
        server.handle_request()  # Handle exactly one request then stop

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    thread.join(timeout=timeout)
    server.server_close()

    if not CallbackHandler.result:
        raise TimeoutError(f"No callback received within {timeout} seconds.")

    return CallbackHandler.result


# ── Token exchange ────────────────────────────────────────────────────────────

def exchange_code(tenant_id: str, client_id: str, client_secret: str,
                  code: str, code_verifier: str) -> dict:
    """Exchange authorisation code for access + refresh tokens."""
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

    payload = urllib.parse.urlencode({
        "client_id":     client_id,
        "client_secret": client_secret,
        "grant_type":    "authorization_code",
        "code":          code,
        "redirect_uri":  REDIRECT_URI,
        "code_verifier": code_verifier,
    }).encode()

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def decode_id_token_email(id_token: str) -> str:
    """Extract email/upn from JWT id_token without verifying signature."""
    try:
        payload = id_token.split(".")[1]
        payload += "=" * (4 - len(payload) % 4)  # Pad base64
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return claims.get("email") or claims.get("upn") or claims.get("preferred_username", "unknown")
    except Exception:
        return "unknown"


# ── Main auth flow ────────────────────────────────────────────────────────────

def do_auth(config: dict, permissions: list[str], force: bool = False):
    """Run the full OAuth flow."""
    tenant_id     = config["tenant_id"]
    client_id     = config["client_id"]
    client_secret = get_or_retrieve_client_secret(config)

    # Check existing session
    if not force:
        tokens = load_tokens()
        if tokens:
            age = time.time() - tokens.get("session_started_at", 0)
            if age < MAX_SESSION_AGE:
                days_left = int((MAX_SESSION_AGE - age) / 86400)
                email = tokens.get("user_email", "unknown")
                print(f"\n  ✓ Already authenticated as {email}")
                print(f"    Session valid for ~{days_left} more days.")
                print(f"    Use --reauth to force a new login.\n")
                return
            else:
                print("  Session has expired (>30 days). Starting re-authentication...\n")

    # Build scopes and PKCE
    scopes                  = build_scopes(permissions)
    code_verifier, challenge = generate_pkce()
    state                   = secrets.token_urlsafe(32)

    auth_url = build_auth_url(tenant_id, client_id, scopes, state, challenge)

    print("  Opening browser for Microsoft login...")
    print(f"  Requested permissions: {', '.join(permissions)}")
    print()
    print("  If the browser doesn't open, paste this URL manually:")
    print(f"  {auth_url}\n")

    webbrowser.open(auth_url)

    # Wait for redirect
    print("  Waiting for authentication... (2 minute timeout)")
    try:
        result = wait_for_callback(state, timeout=120)
    except TimeoutError:
        print("\n  [error] Timed out. Please run auth.sh again.")
        sys.exit(1)

    if "error" in result:
        print(f"\n  [error] Auth failed: {result['error']}")
        print(f"          {result.get('description', '')}")
        sys.exit(1)

    # Validate state to prevent CSRF
    if not hmac.compare_digest(result.get("state", ""), state):
        print("\n  [error] State mismatch — possible CSRF. Aborting.")
        sys.exit(1)

    print("  Login successful. Exchanging code for tokens...")

    token_response = exchange_code(tenant_id, client_id, client_secret,
                                   result["code"], code_verifier)

    email = decode_id_token_email(token_response.get("id_token", ""))

    # Build token record
    tokens = {
        "access_token":            token_response["access_token"],
        "refresh_token":           token_response["refresh_token"],
        "access_token_expires_at": time.time() + token_response.get("expires_in", 3600) - 60,
        "session_started_at":      time.time(),   # Never updated — enforces 30-day limit
        "scopes":                  token_response.get("scope", "").split(),
        "user_email":              email,
        "tenant_id":               tenant_id,
        "client_id":               client_id,
    }

    save_tokens(tokens)

    print(f"\n  ✓ Authenticated as: {email}")
    print(f"    Scopes granted: {', '.join(tokens['scopes'])}")
    print(f"    Tokens encrypted and stored at: {TOKEN_FILE}")
    print(f"    Encryption key stored in OS keychain.")
    print(f"    Session will expire in 30 days.\n")


def do_status():
    """Print current auth status."""
    tokens = load_tokens()
    if not tokens:
        print("\n  Not authenticated. Run auth.sh to set up.\n")
        return

    age      = time.time() - tokens.get("session_started_at", 0)
    days_used = int(age / 86400)
    days_left = max(0, int((MAX_SESSION_AGE - age) / 86400))
    token_exp = tokens.get("access_token_expires_at", 0)
    token_ok  = time.time() < token_exp

    print(f"\n  User:          {tokens.get('user_email', 'unknown')}")
    print(f"  Session age:   {days_used} days used, ~{days_left} days remaining")
    print(f"  Access token:  {'valid' if token_ok else 'expired (will auto-refresh)'}")
    print(f"  Scopes:        {', '.join(tokens.get('scopes', []))}")
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
    print(f"\n  ✓ Tokens for {email} have been revoked and deleted.")
    print(f"    Keychain entry removed.\n")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Azure OAuth skill authentication")
    parser.add_argument("--reauth",  action="store_true", help="Force new browser login")
    parser.add_argument("--revoke",  action="store_true", help="Delete all stored tokens")
    parser.add_argument("--status",  action="store_true", help="Show auth status")
    parser.add_argument("--scopes",  nargs="*", default=DEFAULT_PERMISSIONS,
                        help=f"Permissions to request. Options: {list(SCOPE_CATALOGUE.keys())}")
    args = parser.parse_args()

    # Load config
    if not CONFIG_FILE.exists():
        print(f"[error] Config not found at {CONFIG_FILE}")
        sys.exit(1)

    with open(CONFIG_FILE) as f:
        config = json.load(f)

    if args.revoke:
        do_revoke()
    elif args.status:
        do_status()
    else:
        do_auth(config, args.scopes, force=args.reauth)


if __name__ == "__main__":
    main()
