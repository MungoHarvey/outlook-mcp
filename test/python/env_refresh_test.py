"""Loop 200 / amendment A1 — refresh must work from .env alone.

Proves the dependency-free .env parser populates os.environ and that
_refresh_access_token obtains client_secret from the environment when it is
absent from tokens.json (the post-2.3 world), with no python-dotenv involved.
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "outlook-skills"))

import token_helper  # noqa: E402


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class EnvRefreshTest(unittest.TestCase):

    def test_env_parser_populates_environ_without_dotenv(self):
        with tempfile.TemporaryDirectory() as d:
            envf = Path(d) / ".env"
            envf.write_text(
                '# a comment\n'
                'OUTLOOK_CLIENT_SECRET="s3cret-value"\n'
                "OUTLOOK_TENANT_ID=common\n"
                "\n"
            )
            os.environ.pop("OUTLOOK_CLIENT_SECRET", None)
            token_helper._load_env_file(envf)
            self.assertEqual(os.environ.get("OUTLOOK_CLIENT_SECRET"), "s3cret-value")

    def test_parser_is_dependency_free(self):
        # token_helper must not require python-dotenv to be importable.
        self.assertTrue(hasattr(token_helper, "_load_env_file"))

    def test_refresh_uses_env_secret_when_absent_from_tokens(self):
        os.environ["OUTLOOK_CLIENT_SECRET"] = "env-secret"
        try:
            tokens = {  # deliberately NO client_secret key
                "tenant_id": "common",
                "client_id": "cid",
                "refresh_token": "old-rt",
            }
            payload = json.dumps({
                "access_token": "newAT",
                "expires_in": 3600,
                "refresh_token": "rotated-rt",
            }).encode()
            with mock.patch("urllib.request.urlopen", return_value=_FakeResp(payload)):
                updated = token_helper._refresh_access_token(dict(tokens))
            self.assertEqual(updated["access_token"], "newAT")
            self.assertEqual(updated["refresh_token"], "rotated-rt")
        finally:
            os.environ.pop("OUTLOOK_CLIENT_SECRET", None)

    def test_refresh_without_secret_anywhere_raises(self):
        os.environ.pop("OUTLOOK_CLIENT_SECRET", None)
        tokens = {"tenant_id": "common", "client_id": "cid", "refresh_token": "rt"}
        with self.assertRaises(token_helper.AuthRequiredError):
            token_helper._refresh_access_token(dict(tokens))


if __name__ == "__main__":
    unittest.main()
