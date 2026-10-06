#!/usr/bin/env python3
"""
graph_call.py — Secure Microsoft Graph API proxy.
Makes authenticated API calls without exposing tokens to callers.

Usage:
  python3 scripts/graph_call.py METHOD "/endpoint" ['{"json":"body"}' | - | @FILE]
      [--header "Key: Value"] [--out-dir DIR --out-name NAME] [--raw-body]

Message content in responses (bodies, subjects, names) is sanitised by
default — see scripts/sanitize.py. Absolute Graph v1.0 URLs (@odata.nextLink)
are accepted; any other host is rejected.

Examples:
  python3 scripts/graph_call.py GET "/me"
  python3 scripts/graph_call.py POST "/me/sendMail" '{"message":{...}}'
  python3 scripts/graph_call.py GET "/me/calendarView?..." --header "Prefer: outlook.timezone=\"UTC\""
"""

import sys
import os
import json
import re
import argparse
import posixpath
import urllib.parse
import urllib.request
import urllib.error
import glob
import http.client
import socket
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
    """Lazily import token_helper on first actual request.

    Returns (get_token, AuthRequiredError, TokenRefreshError,
    NotAuthenticatedError, AuthConfigError). The last two fall back to
    harmless placeholders so an older token_helper still works.
    """
    try:
        import token_helper as th
    except ImportError:
        _error = {
            "status": 503,
            "error": "import_error",
            "message": f"Could not import token_helper. Run: {_AUTH_CMD}"
        }
        print(json.dumps(_error))
        sys.exit(1)

    class _Never(Exception):
        pass

    return (th.get_token, th.AuthRequiredError, th.TokenRefreshError,
            getattr(th, "NotAuthenticatedError", _Never),
            getattr(th, "AuthConfigError", _Never))


def _get_missing_scopes():
    """Return required Graph scopes absent from the stored grant (best-effort)."""
    try:
        from token_helper import missing_scopes
        return missing_scopes()
    except Exception:
        return []


# ── Constants ──────────────────────────────────────────────────────────────────
GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
ALLOWED_METHODS = {"GET", "POST", "PATCH", "DELETE", "PUT"}
REQUEST_TIMEOUT = 30

# Re-auth hint: a dead or revoked session needs --reauth — the plain command
# short-circuits with "Already authenticated" while the 30-day window is open.
_REAUTH_CMD = f"{_AUTH_CMD} -Reauth" if sys.platform == "win32" else f"{_AUTH_CMD} --reauth"

# Inline-output limits — keep large payloads out of the model's context.
CONTENT_BYTES_INLINE_LIMIT = 2048     # base64 chars of an attachment shown inline
TEXT_INLINE_LIMIT = 100_000           # chars of a text/plain response shown inline

# Characters left as-is when percent-encoding an endpoint. Everything else
# (spaces, quotes, '#', '<', '>', non-ASCII, control chars) is encoded so that
# `$search="two words"` and `displayName eq 'My Projects'` form a valid URL.
_URL_SAFE = "/?&=$'(),:;@!*+%~-._"


# ── Endpoint validation (pure, testable seam) ──────────────────────────────────

def validate_endpoint(endpoint):
    """Normalise and validate an endpoint before it is sent.

    1. An absolute URL is accepted only when it is a Graph v1.0 URL
       (`@odata.nextLink` / `@odata.deltaLink` values); the prefix is stripped
       and the remainder validated like any other endpoint. Any other scheme
       or host is rejected — the proxy never sends the token elsewhere.
    2. Git-Bash (MSYS) path mangling is self-healed: on Windows, Git Bash
       rewrites an argument starting with "/" into a Windows path (e.g.
       "/me" -> "C:/.../Git/me"). Only a drive-letter-prefixed endpoint can
       be mangled — a real Graph endpoint never starts with "<drive>:".
    3. Backslashes and double-encoding are rejected outright (traversal
       vectors), then a segment-exact /me or /users/ prefix is required so
       lookalikes like /messages or /memberOf do not slip through.

    Validation is defence-in-depth; the delegated token scopes are the primary
    guard. Returns (healed_endpoint, None) if allowed, or
    (endpoint, error_dict) if rejected.
    """
    _bad = {
        "status": 400,
        "error": "invalid_endpoint",
        "message": "Endpoint must start with /me or /users/"
    }

    # ── 1. Absolute URLs: only Graph v1.0 (pagination / delta links) ──────────
    if re.match(r"^[A-Za-z][A-Za-z0-9+.\-]*://", endpoint) or endpoint.startswith("//"):
        if endpoint.lower().startswith(GRAPH_BASE_URL.lower() + "/"):
            endpoint = endpoint[len(GRAPH_BASE_URL):]
        else:
            return endpoint, {
                "status": 400,
                "error": "invalid_endpoint",
                "message": (f"Absolute URLs must start with {GRAPH_BASE_URL}/ "
                            "(e.g. an @odata.nextLink); otherwise pass a path "
                            "starting with /me or /users/")
            }

    _path_only = endpoint.split("?")[0]
    _query = endpoint[len(_path_only):]  # includes leading "?" if present

    # ── 2. MSYS self-heal ─────────────────────────────────────────────────────
    if re.match(r"^[A-Za-z]:[\\/]", _path_only):
        # Greedy prefix picks the rightmost /me or /users segment — the mangled
        # arg is always the tail, so this recovers it even if the install path
        # happens to contain a similar segment.
        _heal = re.match(r"^[A-Za-z]:.*(/(?:me|users)(?:/.*)?)$",
                         _path_only.replace("\\", "/"))
        if _heal:
            _path_only = _heal.group(1)
            endpoint = _path_only + _query

    # ── 3. Traversal vectors, then segment-exact prefix ───────────────────────
    # Backslashes (raw or %5c) are never part of a Graph path, and some URL
    # parsers treat them as "/", which would let "/me\..\..\beta" escape /me.
    # Double-encoding (`%25…`) can't be collapsed by a single unquote+normpath.
    # Single-encoded "/" (%2f) stays allowed — Graph item IDs legitimately
    # contain it — and is covered by the unquote+normpath check below.
    _lower = _path_only.lower()
    if "\\" in _path_only or "%5c" in _lower or "%25" in _lower:
        return endpoint, _bad
    _normalized = posixpath.normpath(urllib.parse.unquote(_path_only))
    if not (_normalized == "/me"
            or _normalized.startswith("/me/")
            or _normalized.startswith("/users/")):
        return endpoint, _bad
    return endpoint, None


def encode_endpoint(endpoint):
    """Percent-encode characters that are not valid in a URL.

    Existing %XX escapes are preserved (so nextLinks and encoded IDs pass
    through unchanged); a bare '%' that is not an escape becomes %25.
    """
    endpoint = re.sub(r"%(?![0-9A-Fa-f]{2})", "%25", endpoint)
    return urllib.parse.quote(endpoint, safe=_URL_SAFE)


# ── Output helpers ─────────────────────────────────────────────────────────────

_WIN_RESERVED = {"CON", "PRN", "AUX", "NUL",
                 *(f"COM{i}" for i in range(1, 10)),
                 *(f"LPT{i}" for i in range(1, 10))}


def safe_filename(name):
    """Reduce an untrusted (sender-chosen) file name to a safe basename.

    Strips any directory part, control/invisible characters and characters
    illegal on Windows; never returns '', '.', '..' or a reserved device name.
    """
    from sanitize import strip_invisible
    name = strip_invisible(str(name or "")).replace("\\", "/").split("/")[-1]
    name = re.sub(r'[\x00-\x1f\x7f<>:"|?*]', "_", name)
    name = name.strip(" .")
    if not name:
        name = "attachment"
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    if stem.split(".")[0].upper() in _WIN_RESERVED:
        name = "_" + name
    if len(name) > 200:
        ext = ("." + ext[:20]) if dot else ""
        name = name[:200 - len(ext)] + ext
    return name


def write_output_file(out_dir, out_name, content):
    """Write bytes to out_dir/safe_filename(out_name) without overwriting.

    An existing file is never replaced: "name (1).ext", "name (2).ext", …
    are tried instead. Returns the path written.
    """
    directory = Path(out_dir or ".").expanduser()
    directory.mkdir(parents=True, exist_ok=True)
    name = safe_filename(out_name)
    stem, ext = os.path.splitext(name)
    for i in range(0, 1000):
        candidate = directory / (name if i == 0 else f"{stem} ({i}){ext}")
        try:
            with open(candidate, "xb") as f:   # exclusive create: no clobber
                f.write(content)
            return candidate
        except FileExistsError:
            continue
    raise FileExistsError(f"Too many files named {name} in {directory}")


def elide_content_bytes(data):
    """Replace large attachment `contentBytes` with a short placeholder."""
    if isinstance(data, dict):
        out = {}
        for k, v in data.items():
            if k == "contentBytes" and isinstance(v, str) and len(v) > CONTENT_BYTES_INLINE_LIMIT:
                out[k] = (f"<omitted: {len(v)} base64 chars — save it with "
                          "--out-dir DIR --out-name NAME>")
            else:
                out[k] = elide_content_bytes(v)
        return out
    if isinstance(data, list):
        return [elide_content_bytes(v) for v in data]
    return data


def build_success(status, raw, content_type, out=None, sanitize=True):
    """Turn a 2xx response into the proxy's {status, data} result.

    - out=(dir, name): save the payload to disk instead of returning it. A
      JSON fileAttachment is saved as its decoded contentBytes; anything else
      (e.g. `/$value` MIME or binary) is saved byte-for-byte.
    - JSON: parsed, message content sanitised (unless sanitize=False), large
      attachment payloads elided.
    - text/plain: returned inline (truncated past TEXT_INLINE_LIMIT).
    - anything else (binary, MIME): never inlined — metadata plus a hint.
    """
    ctype = (content_type or "").split(";")[0].strip().lower()
    is_json = ctype.endswith("json")

    if out is not None:
        payload = raw
        if is_json and raw:
            try:
                obj = json.loads(raw.decode("utf-8"))
                if isinstance(obj, dict) and isinstance(obj.get("contentBytes"), str):
                    import base64
                    payload = base64.b64decode(obj["contentBytes"])
            except Exception:
                pass
        path = write_output_file(out[0], out[1], payload)
        return {"status": status,
                "data": {"saved_to": str(path), "bytes": len(payload),
                         "content_type": ctype or None}}

    if not raw:
        return {"status": status, "data": None}

    if is_json or not ctype:
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            data = None
        else:
            if sanitize:
                from sanitize import sanitize_response
                data = sanitize_response(data)
            return {"status": status, "data": elide_content_bytes(data)}

    if ctype == "text/plain":
        text = raw.decode("utf-8", errors="replace")
        result = {"status": status, "data": text[:TEXT_INLINE_LIMIT]}
        if len(text) > TEXT_INLINE_LIMIT:
            result["truncated"] = True
        if sanitize:
            from sanitize import sanitize_response
            result["data"] = sanitize_response(
                {"contentType": "text", "content": result["data"]})["content"]
        return result

    return {
        "status": status,
        "data": None,
        "content_type": ctype or None,
        "bytes": len(raw),
        "message": ("Non-JSON response not shown. Re-run with "
                    "--out-dir DIR --out-name NAME to save it to a file.")
    }


# ── Redirect handling: never forward the token to another host ────────────────

class _SameHostAuthRedirect(urllib.request.HTTPRedirectHandler):
    """urllib copies headers onto redirects; the token is added as an
    *unredirected* header, so it is dropped by default, and re-attached here
    only when the redirect stays on the same host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None:
            old_host = urllib.parse.urlsplit(req.full_url).netloc.lower()
            new_host = urllib.parse.urlsplit(newurl).netloc.lower()
            auth = req.unredirected_hdrs.get("Authorization")
            if auth and old_host == new_host:
                new.add_unredirected_header("Authorization", auth)
        return new


_OPENER = urllib.request.build_opener(_SameHostAuthRedirect)


# ── make_request function ──────────────────────────────────────────────────────

def make_request(method, endpoint, body, headers, _retried=False,
                 out=None, sanitize=True):
    """
    Execute a Microsoft Graph API request.

    Args:
        method: HTTP method (GET, POST, PATCH, DELETE, PUT)
        endpoint: API endpoint (e.g., "/me/messages") or a Graph v1.0
            absolute URL such as an @odata.nextLink
        body: JSON request body (or None)
        headers: Dict of additional headers
        _retried: Internal flag for 401 retry logic
        out: Optional (out_dir, out_name) — save the response to a file
        sanitize: Neutralise message content in the response (default True)

    Returns:
        Dict with keys: status, data (or error, message on failure)
    """
    # ── Get token functions ────────────────────────────────────────────────────
    (get_token, AuthRequiredError, TokenRefreshError,
     NotAuthenticatedError, AuthConfigError) = _ensure_token_helper()

    # ── Validate + self-heal endpoint (pure seam — see validate_endpoint) ───────
    endpoint, _err = validate_endpoint(endpoint)
    if _err:
        return _err

    # ── Build URL ──────────────────────────────────────────────────────────────
    url = GRAPH_BASE_URL + encode_endpoint(endpoint)

    # ── Get token (private variable — never printed) ────────────────────────────
    # On the 401 retry, force a real refresh — the server rejected a token that
    # still looked unexpired locally, so re-fetching the cached one would loop.
    try:
        _tok = get_token(force_refresh=_retried)
    except NotAuthenticatedError:
        return {
            "status": 401,
            "error": "auth_required",
            "message": f"Not signed in. Run: {_AUTH_CMD}"
        }
    except AuthRequiredError:
        return {
            "status": 401,
            "error": "auth_required",
            "message": f"Sign-in expired or was revoked. Run: {_REAUTH_CMD}"
        }
    except AuthConfigError as e:
        return {
            "status": 401,
            "error": "auth_config",
            "message": str(e)
        }
    except TokenRefreshError:
        return {
            "status": 503,
            "error": "token_refresh_failed",
            "message": "Transient token refresh error (network). Please retry."
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

    # ── Add authorization header (unredirected — see _SameHostAuthRedirect) ────
    req.add_unredirected_header("Authorization", f"Bearer {_tok}")

    # ── Add Content-Type for POST/PATCH ────────────────────────────────────────
    if method in ("POST", "PATCH"):
        req.add_header("Content-Type", "application/json")

    # ── Add custom headers ─────────────────────────────────────────────────────
    for header_name, header_value in headers.items():
        req.add_header(header_name, header_value)

    # ── Execute request ────────────────────────────────────────────────────────
    try:
        with _OPENER.open(req, timeout=REQUEST_TIMEOUT) as resp:
            status_code = resp.status
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
        return build_success(status_code, raw, content_type, out=out, sanitize=sanitize)

    except urllib.error.HTTPError as e:
        # ── Handle 401 with auto-retry ────────────────────────────────────────
        if e.code == 401 and not _retried:
            # Retry once with a forced token refresh
            return make_request(method, endpoint, body, headers, _retried=True,
                                out=out, sanitize=sanitize)
        elif e.code == 401:
            return {
                "status": 401,
                "error": "auth_required",
                "message": f"Sign-in expired or was revoked. Run: {_REAUTH_CMD}"
            }

        # ── Parse other error responses ────────────────────────────────────────
        try:
            error_body = e.read().decode("utf-8")
            error_data = json.loads(error_body)
        except Exception:
            error_data = {}

        # ── Augment 403 with an actionable hint ────────────────────────────────
        # Two cases: (a) a user-consentable scope is missing → run --reauth;
        # (b) the grant already covers all requested scopes → the operation
        # likely needs an admin-consent scope (contacts-write, rules, categories),
        # which --reauth cannot grant.
        _message = e.reason
        if e.code == 403:
            _missing = _get_missing_scopes()
            if _missing:
                _message = (f"{e.reason} — your sign-in is missing permissions "
                            f"({', '.join(_missing)}). Run: {_REAUTH_CMD}")
            else:
                _message = (f"{e.reason} — if this is add/update contacts, inbox "
                            "rules, or categories, it needs Contacts.ReadWrite / "
                            "MailboxSettings.ReadWrite, which require Azure admin "
                            "consent (not available via --reauth).")

        result = {
            "status": e.code,
            "error": "http_error",
            "message": _message,
            "details": error_data if error_data else None
        }
        # ── Throttling: surface Retry-After so the caller can back off ─────────
        _retry_after = e.headers.get("Retry-After") if e.headers else None
        if _retry_after:
            result["retry_after"] = _retry_after
        return result

    except (http.client.InvalidURL, ValueError):
        return {
            "status": 400,
            "error": "invalid_url",
            "message": "The endpoint could not be turned into a valid URL"
        }

    except urllib.error.URLError as e:
        if isinstance(e.reason, (TimeoutError, socket.timeout)):
            return {"status": 504, "error": "timeout",
                    "message": f"No response from Graph within {REQUEST_TIMEOUT}s"}
        return {
            "status": 503,
            "error": "network_error",
            "message": str(e.reason)
        }

    except (TimeoutError, socket.timeout):
        return {"status": 504, "error": "timeout",
                "message": f"No response from Graph within {REQUEST_TIMEOUT}s"}

    except OSError as e:
        # e.g. the --out directory is not writable
        return {"status": 500, "error": "io_error", "message": str(e)}

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


def read_body_arg(body):
    """Resolve the body argument: '-' reads stdin, '@path' reads a file.

    Passing the body on stdin (a quoted heredoc) avoids both the OS argument
    length limit (~128 KiB on Linux, ~32 K chars on Windows) and shell-quoting
    problems when the JSON contains apostrophes or text copied from an email.
    """
    if body == "-":
        return sys.stdin.buffer.read().decode("utf-8")
    if body and body.startswith("@"):
        return Path(body[1:]).expanduser().read_text(encoding="utf-8")
    return body


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
  python3 scripts/graph_call.py POST "/me/sendMail" - <<'JSON'
  {"message":{"subject":"Test"}}
  JSON
  python3 scripts/graph_call.py GET '<@odata.nextLink value>'
  python3 scripts/graph_call.py GET "/me/messages/{id}/attachments/{aid}/\\$value" \\
      --out-dir ~/Downloads --out-name "report.pdf"
        """
        )

        parser.add_argument(
            "method",
            help="HTTP method"
        )

        parser.add_argument(
            "endpoint",
            help="Graph API endpoint (e.g., /me/messages) or an @odata.nextLink URL"
        )

        parser.add_argument(
            "body",
            nargs="?",
            default=None,
            help="JSON request body (optional); '-' reads stdin, '@FILE' reads a file"
        )

        parser.add_argument(
            "--header",
            action="append",
            dest="headers",
            help="Custom header (format: 'Key: Value'); can be repeated"
        )

        parser.add_argument(
            "--out-dir",
            default=None,
            help="Directory to save the response into (used with --out-name; default: .)"
        )

        parser.add_argument(
            "--out-name",
            default=None,
            help="Save the response to this file name instead of printing it. "
                 "The name is sanitised (no directories) and never overwrites."
        )

        parser.add_argument(
            "--raw-body",
            action="store_true",
            help="Return message bodies unsanitised (only for your OWN drafts; "
                 "never for received mail)"
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

        # ── Resolve body (stdin / file) ────────────────────────────────────────────
        try:
            body = read_body_arg(args.body)
        except OSError as e:
            print(json.dumps({"status": 400, "error": "invalid_body",
                              "message": f"Could not read body: {e.strerror}"}))
            sys.exit(1)

        # ── Parse headers ──────────────────────────────────────────────────────────
        headers = parse_headers(args.headers or [])

        out = None
        if args.out_name:
            out = (args.out_dir or ".", args.out_name)
        elif args.out_dir:
            print(json.dumps({"status": 400, "error": "invalid_arguments",
                              "message": "--out-dir requires --out-name"}))
            sys.exit(1)

        # ── Make request ───────────────────────────────────────────────────────────
        result = make_request(
            method=args.method,
            endpoint=args.endpoint,
            body=body,
            headers=headers,
            out=out,
            sanitize=not args.raw_body,
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
