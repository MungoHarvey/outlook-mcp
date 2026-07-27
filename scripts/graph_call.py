#!/usr/bin/env python3
"""
graph_call.py — Secure Microsoft Graph API proxy.
Makes authenticated API calls without exposing tokens to callers.

Usage:
  python3 scripts/graph_call.py METHOD "/endpoint" ['{"json":"body"}'] [--header "Key: Value"]

Examples:
  python3 scripts/graph_call.py GET "/me"
  python3 scripts/graph_call.py POST "/me/sendMail" '{"message":{...}}'
  python3 scripts/graph_call.py GET "/me/calendarView?..." --header "Prefer: outlook.timezone=\"UTC\""
"""

import sys
import os
import json
import argparse
import posixpath
import urllib.parse
import urllib.request
import urllib.error
import glob
from pathlib import Path

# ── Bootstrap: add outlook-skills to sys.path ─────────────────────────────────
_skills_dir = Path(__file__).parent.parent / "outlook-skills"
if str(_skills_dir) not in sys.path:
    sys.path.insert(0, str(_skills_dir))

# Absolute auth-command hint — repo-relative paths are meaningless when this
# runs from a plugin cache directory
_AUTH_CMD = (
    f'powershell -File "{_skills_dir / "auth.ps1"}"'
    if sys.platform == "win32"
    else f'bash "{_skills_dir / "auth.sh"}"'
)

# ── Bootstrap: optionally add venv site-packages (for dotenv if installed) ────
# The venv is auth state, so it may live outside the plugin tree. Check the
# same candidate locations token_helper uses for its state dir:
# OUTLOOK_SKILLS_HOME override, the in-tree outlook-skills/ dir (cloned-repo
# layout), then ~/.outlook-skills.
_venv_candidates = []
if os.environ.get("OUTLOOK_SKILLS_HOME"):
    _venv_candidates.append(Path(os.environ["OUTLOOK_SKILLS_HOME"]).expanduser() / ".venv")
_venv_candidates.append(_skills_dir / ".venv")
_venv_candidates.append(Path.home() / ".outlook-skills" / ".venv")

for _venv_base in _venv_candidates:
    if sys.platform == "win32":
        _site_pkgs = _venv_base / "Lib" / "site-packages"
    else:
        _matches = glob.glob(str(_venv_base / "lib" / "python3.*" / "site-packages"))
        _site_pkgs = Path(_matches[0]) if _matches else None
    if _site_pkgs and _site_pkgs.exists():
        sys.path.insert(0, str(_site_pkgs))
        break


# ── Lazy-import token helper (deferred to allow --help without auth deps) ──────
def _ensure_token_helper():
    """Lazily import token_helper on first actual request."""
    try:
        from token_helper import get_token, AuthRequiredError
        return get_token, AuthRequiredError
    except ImportError:
        _error = {
            "status": 503,
            "error": "import_error",
            "message": f"Could not import token_helper. Run: {_AUTH_CMD}"
        }
        print(json.dumps(_error))
        sys.exit(1)


# ── Constants ──────────────────────────────────────────────────────────────────
GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
ALLOWED_METHODS = {"GET", "POST", "PATCH", "DELETE", "PUT"}


# ── make_request function ──────────────────────────────────────────────────────

def make_request(method, endpoint, body, headers, _retried=False):
    """
    Execute a Microsoft Graph API request.

    Args:
        method: HTTP method (GET, POST, PATCH, DELETE, PUT)
        endpoint: API endpoint (e.g., "/me/messages")
        body: JSON request body (or None)
        headers: Dict of additional headers
        _retried: Internal flag for 401 retry logic

    Returns:
        Dict with keys: status, data (or error, message on failure)
    """
    # ── Get token functions ────────────────────────────────────────────────────
    get_token, AuthRequiredError = _ensure_token_helper()

    # ── Validate endpoint prefix (defence-in-depth — token scopes are the primary guard) ──
    _path_only = endpoint.split("?")[0]
    _normalized = posixpath.normpath(urllib.parse.unquote(_path_only))
    if not (_normalized.startswith("/me") or _normalized.startswith("/users/")):
        return {
            "status": 400,
            "error": "invalid_endpoint",
            "message": "Endpoint must start with /me or /users/"
        }

    # ── Build URL ──────────────────────────────────────────────────────────────
    url = GRAPH_BASE_URL + endpoint

    # ── Get token (private variable — never printed) ────────────────────────────
    try:
        _tok = get_token()
    except AuthRequiredError:
        return {
            "status": 401,
            "error": "auth_required",
            "message": f"Run: {_AUTH_CMD}"
        }

    # ── Build request ──────────────────────────────────────────────────────────
    req_body = None
    if body:
        req_body = body.encode("utf-8") if isinstance(body, str) else body

    try:
        req = urllib.request.Request(
            url,
            data=req_body,
            method=method
        )
    except Exception:
        return {
            "status": 400,
            "error": "invalid_request",
            "message": "Could not build request"
        }

    # ── Add authorization header ───────────────────────────────────────────────
    req.add_header("Authorization", f"Bearer {_tok}")

    # ── Add Content-Type for POST/PATCH ────────────────────────────────────────
    if method in ("POST", "PATCH"):
        req.add_header("Content-Type", "application/json")

    # ── Add custom headers ─────────────────────────────────────────────────────
    for header_name, header_value in headers.items():
        req.add_header(header_name, header_value)

    # ── Execute request ────────────────────────────────────────────────────────
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status_code = resp.status
            resp_body = resp.read().decode("utf-8")

            # ── Parse response ────────────────────────────────────────────────
            data = None
            if resp_body:
                try:
                    data = json.loads(resp_body)
                except json.JSONDecodeError:
                    data = resp_body

            return {
                "status": status_code,
                "data": data
            }

    except urllib.error.HTTPError as e:
        # ── Handle 401 with auto-retry ────────────────────────────────────────
        if e.code == 401 and not _retried:
            # Retry once — make_request will call get_token() again, triggering silent refresh
            return make_request(method, endpoint, body, headers, _retried=True)
        elif e.code == 401:
            return {
                "status": 401,
                "error": "auth_required",
                "message": f"Run: {_AUTH_CMD}"
            }

        # ── Parse other error responses ────────────────────────────────────────
        try:
            error_body = e.read().decode("utf-8")
            error_data = json.loads(error_body)
        except Exception:
            error_data = {}

        return {
            "status": e.code,
            "error": "http_error",
            "message": e.reason,
            "details": error_data if error_data else None
        }

    except urllib.error.URLError as e:
        return {
            "status": 503,
            "error": "network_error",
            "message": str(e.reason)
        }

    except Exception:
        return {
            "status": 500,
            "error": "internal_error",
            "message": "An unexpected error occurred"
        }


# ── Parse --header arguments ──────────────────────────────────────────────────

def parse_headers(header_list):
    """
    Parse list of "Key: Value" header strings into dict.

    Args:
        header_list: List of strings like ["Content-Type: application/json", ...]

    Returns:
        Dict of headers
    """
    headers = {}
    if not header_list:
        return headers

    for header_str in header_list:
        if ": " not in header_str:
            # Skip malformed headers silently
            continue
        key, value = header_str.split(": ", 1)
        headers[key.strip()] = value.strip()

    return headers


# ── main function ──────────────────────────────────────────────────────────────

def main():
    """Parse CLI arguments and execute request."""
    try:
        parser = argparse.ArgumentParser(
            description="Secure Microsoft Graph API proxy",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""\
Examples:
  python3 scripts/graph_call.py GET "/me"
  python3 scripts/graph_call.py POST "/me/sendMail" '{"message":{"subject":"Test"}}'
  python3 scripts/graph_call.py GET "/me/messages" --header "Prefer: outlook.timezone=UTC"
        """
        )

        parser.add_argument(
            "method",
            help="HTTP method"
        )

        parser.add_argument(
            "endpoint",
            help="Graph API endpoint (e.g., /me/messages)"
        )

        parser.add_argument(
            "body",
            nargs="?",
            default=None,
            help="JSON request body (optional)"
        )

        parser.add_argument(
            "--header",
            action="append",
            dest="headers",
            help="Custom header (format: 'Key: Value'); can be repeated"
        )

        args = parser.parse_args()

        # ── Validate method ────────────────────────────────────────────────────────
        if args.method not in ALLOWED_METHODS:
            result = {
                "status": 400,
                "error": "invalid_method",
                "message": f"Method must be one of: {', '.join(ALLOWED_METHODS)}"
            }
            print(json.dumps(result))
            sys.exit(1)

        # ── Parse headers ──────────────────────────────────────────────────────────
        headers = parse_headers(args.headers or [])

        # ── Make request ───────────────────────────────────────────────────────────
        result = make_request(
            method=args.method,
            endpoint=args.endpoint,
            body=args.body,
            headers=headers
        )

        # ── Output as JSON (never including tokens) ────────────────────────────────
        print(json.dumps(result))

    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception:
        # ── Top-level exception handler: no tokens in local variables ────────────
        print(json.dumps({
            "status": 500,
            "error": "internal_error",
            "message": "An unexpected error occurred"
        }))


if __name__ == "__main__":
    main()
