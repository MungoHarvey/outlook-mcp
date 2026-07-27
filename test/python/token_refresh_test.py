"""Loop 230 — behavioral tests for the token lifecycle.

Covers refresh success + rotation, invalid_grant -> AuthRequiredError, network
error -> TokenRefreshError, cached-token short-circuit, force_refresh bypass,
expiry-triggered refresh, and 30-day session wipe. Uses a mocked token endpoint
and injected expiry timestamps — no network, no sleep.
"""
import io
import json
import os
import sys
import tempfile
import time
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "outlook-skills"))

import token_helper  # noqa: E402


def _http_error(code, payload):
    return urllib.error.HTTPError(
        "https://login.microsoftonline.com", code, "err", {},
        io.BytesIO(json.dumps(payload).encode()),
    )


class _Resp:
    def __init__(self, payload):
        self._p = json.dumps(payload).encode()

    def read(self):
        return self._p

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class TokenRefreshTest(unittest.TestCase):

    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        base = Path(self._dir.name)
        self._tf, self._lf = token_helper.TOKEN_FILE, token_helper.LOCK_FILE
        token_helper.TOKEN_FILE = base / "tokens.json"
        token_helper.LOCK_FILE = base / "tokens.json.lock"
        os.environ["OUTLOOK_CLIENT_SECRET"] = "secret"

    def tearDown(self):
        token_helper.TOKEN_FILE, token_helper.LOCK_FILE = self._tf, self._lf
        os.environ.pop("OUTLOOK_CLIENT_SECRET", None)
        self._dir.cleanup()

    def _write(self, tokens):
        token_helper.TOKEN_FILE.write_text(json.dumps(tokens))

    # ── _refresh_access_token ───────────────────────────────────────────────────
    def test_refresh_success_rotates_refresh_token(self):
        t = {"tenant_id": "common", "client_id": "c", "refresh_token": "old"}
        with mock.patch("urllib.request.urlopen",
                        return_value=_Resp({"access_token": "AT", "expires_in": 3600,
                                            "refresh_token": "new"})):
            up = token_helper._refresh_access_token(dict(t))
        self.assertEqual(up["access_token"], "AT")
        self.assertEqual(up["refresh_token"], "new")

    def test_invalid_grant_raises_auth_required(self):
        t = {"tenant_id": "common", "client_id": "c", "refresh_token": "old"}
        with mock.patch("urllib.request.urlopen",
                        side_effect=_http_error(400, {"error": "invalid_grant"})):
            with self.assertRaises(token_helper.AuthRequiredError):
                token_helper._refresh_access_token(dict(t))

    def test_network_error_raises_token_refresh(self):
        t = {"tenant_id": "common", "client_id": "c", "refresh_token": "old"}
        with mock.patch("urllib.request.urlopen",
                        side_effect=urllib.error.URLError("connection refused")):
            with self.assertRaises(token_helper.TokenRefreshError):
                token_helper._refresh_access_token(dict(t))

    # ── get_token ───────────────────────────────────────────────────────────────
    def test_valid_token_returned_without_refresh(self):
        self._write({"access_token": "cached",
                     "access_token_expires_at": time.time() + 9999,
                     "session_started_at": time.time()})
        with mock.patch.object(token_helper, "_refresh_access_token",
                               side_effect=AssertionError("must not refresh")):
            self.assertEqual(token_helper.get_token(), "cached")

    def test_force_refresh_bypasses_valid_cache(self):
        self._write({"access_token": "cached",
                     "access_token_expires_at": time.time() + 9999,
                     "session_started_at": time.time(),
                     "refresh_token": "r", "tenant_id": "common", "client_id": "c"})
        with mock.patch("urllib.request.urlopen",
                        return_value=_Resp({"access_token": "fresh", "expires_in": 3600})):
            self.assertEqual(token_helper.get_token(force_refresh=True), "fresh")

    def test_expired_token_triggers_refresh(self):
        self._write({"access_token": "old",
                     "access_token_expires_at": time.time() - 10,
                     "session_started_at": time.time(),
                     "refresh_token": "r", "tenant_id": "common", "client_id": "c"})
        with mock.patch("urllib.request.urlopen",
                        return_value=_Resp({"access_token": "renewed", "expires_in": 3600})):
            self.assertEqual(token_helper.get_token(), "renewed")

    def test_session_older_than_30_days_wipes_and_raises(self):
        self._write({"access_token": "x",
                     "access_token_expires_at": time.time() + 9999,
                     "session_started_at": time.time() - (31 * 86400)})
        with self.assertRaises(token_helper.AuthRequiredError):
            token_helper.get_token()
        self.assertEqual(json.loads(token_helper.TOKEN_FILE.read_text()), {})


if __name__ == "__main__":
    unittest.main()
