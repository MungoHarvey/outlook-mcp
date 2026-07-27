"""Tests for token_helper.missing_scopes — the re-auth scope-drift detector."""
import sys
import unittest
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO / "outlook-skills"))

import token_helper  # noqa: E402


class ScopeDriftTest(unittest.TestCase):

    def setUp(self):
        # Required Graph scopes come from the canonical scopes.json.
        self.required = token_helper._required_graph_scopes()

    def test_required_excludes_oidc(self):
        for oidc in ("openid", "profile", "email", "offline_access"):
            self.assertNotIn(oidc, self.required)

    def test_required_is_user_consentable_only(self):
        # The admin-gated scopes must NOT be in the requested/required set —
        # they trigger admin approval and are held in admin_consent_scopes.
        self.assertNotIn("Contacts.ReadWrite", self.required)
        self.assertNotIn("MailboxSettings.ReadWrite", self.required)
        # A core user-consentable scope must be present.
        self.assertIn("Mail.ReadWrite", self.required)

    def test_full_grant_has_no_drift(self):
        tokens = {"scopes": list(self.required) + ["openid", "profile"]}
        self.assertEqual(token_helper.missing_scopes(tokens), [])

    def test_missing_scope_detected(self):
        tokens = {"scopes": [s for s in self.required if s != "Mail.ReadWrite"]}
        self.assertEqual(token_helper.missing_scopes(tokens), ["Mail.ReadWrite"])

    def test_recognizes_full_uri_scopes(self):
        # Some tenants return fully-qualified scope URIs.
        tokens = {"scopes": ["https://graph.microsoft.com/" + s for s in self.required]}
        self.assertEqual(token_helper.missing_scopes(tokens), [])

    def test_case_insensitive(self):
        tokens = {"scopes": [s.upper() for s in self.required]}
        self.assertEqual(token_helper.missing_scopes(tokens), [])

    def test_empty_grant_flags_all(self):
        self.assertEqual(sorted(token_helper.missing_scopes({"scopes": []})),
                         sorted(self.required))


if __name__ == "__main__":
    unittest.main()
