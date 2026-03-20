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
import json
import argparse
import urllib.request
import urllib.error
import glob
from pathlib import Path


# ── Bootstrap: add venv site-packages to sys.path ──────────────────────────────
_script_dir = Path(__file__).parent
_venv_base = _script_dir.parent / "outlook-skills" / ".venv"

if sys.platform == "win32":
    _site_pkgs = _venv_base / "Lib" / "site-packages"
else:
    # POSIX: lib/python3.X/site-packages
    _matches = glob.glob(str(_venv_base / "lib" / "python3.*" / "site-packages"))
    _site_pkgs = Path(_matches[0]) if _matches else None

if _site_pkgs and _site_pkgs.exists():
    sys.path.insert(0, str(_site_pkgs))


# ── Bootstrap: check venv exists ──────────────────────────────────────────────
if not (_site_pkgs and _site_pkgs.exists()):
    print(json.dumps({
        "status": 500,
        "error": "venv_missing",
        "message": "Run: bash outlook-skills/auth.sh to set up dependencies"
    }))
    sys.exit(1)


# ── Bootstrap: add outlook-skills to sys.path ─────────────────────────────────
_skills_dir = Path(__file__).parent.parent / "outlook-skills"
if str(_skills_dir) not in sys.path:
    sys.path.insert(0, str(_skills_dir))


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
            "message": "Could not import token_helper. Run: pip install -r outlook-skills/requirements.txt"
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
    if not (endpoint.startswith("/me") or endpoint.startswith("/users/")):
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
            "message": "Run: bash outlook-skills/auth.sh"
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
            # Try refreshing token and retry once
            try:
                _tok = get_token()
                # Rebuild request with new token
                req_body = None
                if body:
                    req_body = body.encode("utf-8") if isinstance(body, str) else body
                req = urllib.request.Request(url, data=req_body, method=method)
                req.add_header("Authorization", f"Bearer {_tok}")
                if method in ("POST", "PATCH"):
                    req.add_header("Content-Type", "application/json")
                for header_name, header_value in headers.items():
                    req.add_header(header_name, header_value)
                # Recursive call with _retried=True guard
                return make_request(method, endpoint, body, headers, _retried=True)
            except Exception:
                return {
                    "status": 401,
                    "error": "auth_required",
                    "message": "Run: bash outlook-skills/auth.sh"
                }
        elif e.code == 401:
            return {
                "status": 401,
                "error": "auth_required",
                "message": "Run: bash outlook-skills/auth.sh"
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

    except BaseException:
        # ── Top-level exception handler: no tokens in local variables ────────────
        print(json.dumps({
            "status": 500,
            "error": "internal_error",
            "message": "An unexpected error occurred"
        }))


if __name__ == "__main__":
    main()
