"""Scope-contract test — fail-closed.

Parses every graph_call.py invocation in the skills' SKILL.md files, maps each
(verb, endpoint) to the Microsoft Graph scope it requires, and asserts the
canonical outlook-skills/scopes.json grants it. An endpoint that matches no
mapping rule FAILS the test (fail-closed), forcing new skills to register their
scope rather than silently shipping a 403.

Amendment A5: GET verbs map to the read-tier scope; write verbs to the write
tier. MailboxSettings.ReadWrite supersets MailboxSettings.Read, so it covers
both listing and managing rules/categories.
"""
import json
import re
import unittest
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
_SKILLS = _REPO / "skills"
_SCOPES_FILE = _REPO / "outlook-skills" / "scopes.json"

_INVOCATION = re.compile(r'graph_call\.py\s+(GET|POST|PATCH|DELETE|PUT)\s+"([^"]+)"')


def required_scope(method, path):
    """Return the Graph scope (verb, endpoint) needs, or None if unmapped."""
    p = path.lower()
    if "messagerules" in p:
        return "MailboxSettings.ReadWrite"
    if "mastercategories" in p:
        return "MailboxSettings.ReadWrite"
    if (p.endswith("/sendmail") or p.endswith("/send") or p.endswith("/reply")
            or p.endswith("/replyall") or p.endswith("/forward")):
        return "Mail.Send"
    if "/contacts" in p:
        return "Contacts.Read" if method == "GET" else "Contacts.ReadWrite"
    if "/events" in p or "/calendar" in p or "/calendarview" in p:
        return "Calendars.Read" if method == "GET" else "Calendars.ReadWrite"
    if "/messages" in p or "/mailfolders" in p:
        return "Mail.Read" if method == "GET" else "Mail.ReadWrite"
    if p == "/me" or p.startswith("/me?"):
        return "User.Read"
    return None


def _collect_invocations():
    pairs = []
    for skill_md in _SKILLS.glob("*/SKILL.md"):
        for method, endpoint in _INVOCATION.findall(skill_md.read_text(encoding="utf-8")):
            path = endpoint.split("?")[0]
            pairs.append((method, path, skill_md.parent.name))
    return pairs


class ScopeContractTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.scopes = set(json.loads(_SCOPES_FILE.read_text(encoding="utf-8"))["scopes"])
        cls.pairs = _collect_invocations()

    def test_found_invocations(self):
        # Guard against the test silently passing on zero parsed calls.
        self.assertGreaterEqual(len(self.pairs), 10,
                                "parsed too few graph_call invocations — parser may be broken")

    def test_every_endpoint_maps_to_a_scope(self):
        unmapped = sorted({(m, p) for m, p, _ in self.pairs if required_scope(m, p) is None})
        self.assertFalse(
            unmapped,
            "Unmapped endpoints (add a rule to required_scope): "
            + ", ".join(f"{m} {p}" for m, p in unmapped),
        )

    def test_all_required_scopes_are_granted(self):
        missing = []
        for method, path, skill in self.pairs:
            scope = required_scope(method, path)
            if scope and scope not in self.scopes:
                missing.append(f"{skill}: {method} {path} needs {scope}")
        self.assertFalse(
            missing,
            "SCOPES (scopes.json) is missing required scopes:\n  " + "\n  ".join(sorted(set(missing))),
        )


if __name__ == "__main__":
    unittest.main()
