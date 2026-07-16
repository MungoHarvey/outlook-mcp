"""Behavioral tests for graph_call.validate_endpoint (the endpoint guard).

Covers the segment-exact prefix check, Git-Bash (MSYS) path-mangling self-heal,
and encoded-separator traversal rejection. No auth required — validate_endpoint
is a pure function.
"""
import sys
import unittest
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "scripts"))

from graph_call import validate_endpoint  # noqa: E402


class EndpointValidationTest(unittest.TestCase):

    def _ok(self, endpoint, expected_healed=None):
        healed, err = validate_endpoint(endpoint)
        self.assertIsNone(err, f"expected {endpoint!r} to be allowed, got {err}")
        if expected_healed is not None:
            self.assertEqual(healed, expected_healed)

    def _bad(self, endpoint):
        _, err = validate_endpoint(endpoint)
        self.assertIsNotNone(err, f"expected {endpoint!r} to be rejected")
        self.assertEqual(err["status"], 400)
        self.assertEqual(err["error"], "invalid_endpoint")

    # ── Allowed ────────────────────────────────────────────────────────────────
    def test_me_exact(self):
        self._ok("/me")

    def test_me_subpath(self):
        self._ok("/me/messages")

    def test_me_with_query(self):
        self._ok("/me/messages?$select=subject&$top=5", "/me/messages?$select=subject&$top=5")

    def test_users_path(self):
        self._ok("/users/someone@example.com/messages")

    # ── Rejected: substring lookalikes (the startswith bug) ─────────────────────
    def test_reject_messages(self):
        self._bad("/messages")

    def test_reject_memberof(self):
        self._bad("/memberOf")

    def test_reject_metadata_lookalike(self):
        self._bad("/mexico")

    def test_reject_root(self):
        self._bad("/")

    def test_reject_users_bare(self):
        self._bad("/usersfoo")

    # ── Rejected: encoded-separator traversal ───────────────────────────────────
    def test_reject_double_encoded_traversal(self):
        self._bad("/me/..%252Ffoo")

    def test_reject_single_encoded_slash(self):
        self._bad("/me/..%2Ffoo")

    def test_reject_encoded_backslash(self):
        self._bad("/me%5C..%5Cadmin")

    # ── MSYS self-heal: mangled drive paths recover the /me|/users tail ─────────
    def test_heal_me(self):
        self._ok("C:/Program Files/Git/me", "/me")

    def test_heal_me_subpath(self):
        self._ok("C:/Users/x/AppData/Local/Programs/Git/me/messages", "/me/messages")

    def test_heal_me_with_query(self):
        healed, err = validate_endpoint("C:/tools/Git/me/messages?$top=1")
        self.assertIsNone(err)
        self.assertEqual(healed, "/me/messages?$top=1")

    def test_heal_users(self):
        self._ok("D:/git/users/a@b.com/events", "/users/a@b.com/events")

    def test_heal_picks_rightmost_segment(self):
        # An install path containing a lowercase 'me' segment must not fool the heal.
        self._ok("C:/me-tools/Git/me/messages", "/me/messages")

    def test_mangled_invalid_still_rejected(self):
        # A mangled invalid endpoint (no /me|/users tail) stays rejected.
        self._bad("C:/Program Files/Git/messages")


if __name__ == "__main__":
    unittest.main()
