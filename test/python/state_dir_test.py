#!/usr/bin/env python3
"""
Tests for state directory lookup logic in token_helper.py.

Runs the --where command as a subprocess for each scenario in the shared
scenario table, asserting state_dir, token_file, and checked_dirs.

Error-message tests also run as subprocesses, so the real profile is never
read: the fixture's HOME/USERPROFILE only apply to a child process.
"""

import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

# state_fixture is in the same directory; discovery puts test/python on sys.path
from state_fixture import build_fixture, run_where, get_expected_paths, REPO_ROOT


# Runs inside a child process against the fixture's copy of token_helper.py.
# urlopen is replaced first, so any network attempt fails loudly (exit 3).
# Exit 1 means AuthRequiredError was raised and its text is on stdout.
PROBE = """
import json, runpy, sys, urllib.request

def _no_network(*args, **kwargs):
    raise RuntimeError("network access attempted during an auth-message test")

urllib.request.urlopen = _no_network
helper = runpy.run_path(sys.argv[1], run_name="token_helper_under_test")
try:
    helper["get_token"]()
except helper["AuthRequiredError"] as e:
    print(json.dumps({"type": type(e).__name__, "message": str(e)}))
    sys.exit(1)
except Exception as e:
    print(json.dumps({"type": type(e).__name__, "message": str(e)}))
    sys.exit(3)
print(json.dumps({"type": None, "message": ""}))
sys.exit(2)
"""

# Values the fixtures write into auth state; none may appear in an error message.
FIXTURE_SECRETS = (
    "fake-secret-for-tests",
    "fake-client-id-for-tests",
    "fake-access-token-for-tests",
    "fake-refresh-token-for-tests",
)


def load_scenarios():
    """Load the shared scenario table."""
    scenarios_file = REPO_ROOT / "test" / "fixtures" / "state-dir-scenarios.json"
    with open(scenarios_file) as f:
        return json.load(f)


def _run_auth_probe(fixture):
    """Run get_token() from the fixture's helper in a subprocess."""
    helper_path = fixture["plugin_dir"] / "outlook-skills" / "token_helper.py"
    return subprocess.run(
        [sys.executable, "-c", PROBE, str(helper_path)],
        env=fixture["env"],
        capture_output=True,
        text=True,
        timeout=20,
    )


def _expected_auth_cmd(script_dir, action):
    """The runnable reauth command the helper must print for this platform."""
    if sys.platform == "win32":
        return f'powershell -NoProfile -File "{script_dir / "auth.ps1"}" -{action.capitalize()}'
    return f'bash "{script_dir / "auth.sh"}" --{action}'


def _write_expired_tokens(path):
    """Tokens whose access token is expired, with a recent session and no client_secret."""
    path.write_text(json.dumps({
        "access_token": "fake-access-token-for-tests",
        "refresh_token": "fake-refresh-token-for-tests",
        "client_id": "fake-client-id-for-tests",
        "session_started_at": time.time(),
        "access_token_expires_at": 0,
    }))


class TestStateDirResolution(unittest.TestCase):
    """Test state directory resolution against the shared scenario table."""

    def test_all_scenarios(self):
        """Test each scenario row from the shared scenario table."""
        scenarios = load_scenarios()
        for scenario in scenarios:
            with self.subTest(row=scenario["id"]):
                # Skip Windows-only scenarios on non-Windows
                if scenario.get("windows_only") and sys.platform != "win32":
                    self.skipTest("Windows-only scenario")

                fixture = None
                try:
                    fixture = build_fixture(scenario)
                    result = run_where(fixture["plugin_dir"], fixture["env"])

                    expected = get_expected_paths(scenario, fixture)

                    self.assertEqual(
                        result["state_dir"], expected["state_dir"],
                        f"Scenario {scenario['id']}: state_dir mismatch"
                    )
                    self.assertEqual(
                        result["token_file"], expected["token_file"],
                        f"Scenario {scenario['id']}: token_file mismatch"
                    )

                    self.assertEqual(
                        result["checked_dirs"], expected["checked_dirs"],
                        f"Scenario {scenario['id']}: checked_dirs mismatch"
                    )

                finally:
                    if fixture:
                        fixture["cleanup"]()
                        # Clean up override dir if present
                        override_dir = fixture["env"].get("_override_dir")
                        if override_dir:
                            import shutil
                            shutil.rmtree(override_dir, ignore_errors=True)


class TestCheckedDirsOrder(unittest.TestCase):
    """Test that checked_dirs are in the correct order."""

    def test_home_has_env_only(self):
        """Test that checked_dirs contains only ~/.outlook-skills when it has .env."""
        scenario = {
            "id": 99,
            "env": {},
            "home": [".env"],
            "plugin": [],
            "windows_only": False,
            "expected_state_dir": "home",
            "expected_token_file": "state_dir",
        }

        fixture = None
        try:
            fixture = build_fixture(scenario)
            result = run_where(fixture["plugin_dir"], fixture["env"])

            # Rule 2 matches (home/.outlook-skills has .env), so only that is checked
            self.assertEqual(len(result["checked_dirs"]), 1)
            home_state_dir = fixture["home_dir"] / ".outlook-skills"
            self.assertEqual(result["checked_dirs"][0], str(home_state_dir))

        finally:
            if fixture:
                fixture["cleanup"]()

    def test_home_empty_plugin_has_tokens(self):
        """Test that when home/.outlook-skills is empty and plugin has tokens.json,
        both are checked (rules 2 and 3)."""
        scenario = {
            "id": 100,
            "env": {},
            "home": [],
            "plugin": ["tokens.json"],
            "windows_only": False,
            "expected_state_dir": "plugin",
            "expected_token_file": "state_dir",
        }

        fixture = None
        try:
            fixture = build_fixture(scenario)
            result = run_where(fixture["plugin_dir"], fixture["env"])

            # Rule 2 doesn't match (home/.outlook-skills empty), rule 3 matches
            self.assertEqual(len(result["checked_dirs"]), 2)
            home_state_dir = fixture["home_dir"] / ".outlook-skills"
            plugin_dir = fixture["plugin_dir"] / "outlook-skills"
            self.assertEqual(result["checked_dirs"][0], str(home_state_dir))
            self.assertEqual(result["checked_dirs"][1], str(plugin_dir))

        finally:
            if fixture:
                fixture["cleanup"]()

    def test_with_override(self):
        """Test that when OUTLOOK_SKILLS_HOME is set, checked_dirs contains only the override."""
        scenario = {
            "id": 101,
            "env": {"OUTLOOK_SKILLS_HOME": "<override>"},
            "home": [".env", "tokens.json"],
            "plugin": [".env", "tokens.json"],
            "windows_only": False,
            "expected_state_dir": "override",
            "expected_token_file": "state_dir",
        }

        fixture = None
        try:
            fixture = build_fixture(scenario)
            result = run_where(fixture["plugin_dir"], fixture["env"])

            # Should only check the override directory
            self.assertEqual(len(result["checked_dirs"]), 1)
            override_dir = fixture["env"]["OUTLOOK_SKILLS_HOME"]
            self.assertEqual(result["checked_dirs"][0], override_dir)

        finally:
            if fixture:
                fixture["cleanup"]()
                override_dir = fixture["env"].get("_override_dir")
                if override_dir:
                    import shutil
                    shutil.rmtree(override_dir, ignore_errors=True)


class TestErrorMessageContents(unittest.TestCase):
    """Test that AuthRequiredError messages contain the required information."""

    def _auth_error_message(self, result):
        """Require that the probe raised AuthRequiredError; return its text."""
        context = f"exit={result.returncode} stdout={result.stdout!r} stderr={result.stderr!r}"
        self.assertEqual(result.returncode, 1, f"expected AuthRequiredError: {context}")
        payload = json.loads(result.stdout)
        self.assertEqual(payload["type"], "AuthRequiredError", context)
        return payload["message"]

    def test_missing_token_error_message(self):
        """Missing token file: full ordered checked dirs, exact reauth command, no secrets."""
        scenario = {
            "id": 102,
            "env": {},
            "home": [],
            "plugin": [],
            "windows_only": False,
            "expected_state_dir": "home",
            "expected_token_file": "state_dir",
        }

        fixture = None
        try:
            fixture = build_fixture(scenario)
            home_state = fixture["home_dir"] / ".outlook-skills"
            plugin_state = fixture["plugin_dir"] / "outlook-skills"
            cmd = _expected_auth_cmd(plugin_state, "reauth")

            message = self._auth_error_message(_run_auth_probe(fixture))

            self.assertIn("No token file found", message)
            self.assertIn(f"Checked: {home_state}; {plugin_state}.", message)
            self.assertTrue(
                message.endswith(f"Run: {cmd}"),
                f"message must end with the reauth command: {message!r}"
            )
            for secret in FIXTURE_SECRETS:
                self.assertNotIn(secret, message)

        finally:
            if fixture:
                fixture["cleanup"]()

    def test_missing_env_error_message(self):
        """Missing .env with expired tokens: copy advice names the resolved state dir,
        comes before any Azure mention, and no request is attempted."""
        # Tokens sit in the plugin folder (rule 3), so both dirs are checked in order
        # and the resolved state dir is the plugin folder, which has no .env.
        scenario = {
            "id": 103,
            "env": {},
            "home": [],
            "plugin": ["tokens.json"],
            "windows_only": False,
            "expected_state_dir": "plugin",
            "expected_token_file": "state_dir",
        }

        fixture = None
        try:
            fixture = build_fixture(scenario)
            home_state = fixture["home_dir"] / ".outlook-skills"
            plugin_state = fixture["plugin_dir"] / "outlook-skills"
            _write_expired_tokens(plugin_state / "tokens.json")
            cmd = _expected_auth_cmd(plugin_state, "reauth")

            message = self._auth_error_message(_run_auth_probe(fixture))

            self.assertIn(f"Checked: {home_state}; {plugin_state}.", message)
            copy_advice = f"Copy your existing .env to {plugin_state}, then run: {cmd}"
            self.assertTrue(
                message.endswith(copy_advice),
                f"message must end with copy advice and reauth command: {message!r}"
            )

            copy_at = message.index("Copy your existing .env")
            lowered = message.lower()
            for mention in ("azure", "regist"):
                if mention in lowered:
                    self.assertGreater(
                        lowered.index(mention), copy_at,
                        f"'{mention}' must not precede the copy advice: {message!r}"
                    )

            for secret in FIXTURE_SECRETS:
                self.assertNotIn(secret, message)

        finally:
            if fixture:
                fixture["cleanup"]()


class TestNoSecretsLeak(unittest.TestCase):
    """Regression test: verify no fixture secret values appear in outputs."""

    def test_no_secrets_in_scenario_outputs(self):
        """Run all scenarios and verify no fixture secret values appear."""
        scenarios = load_scenarios()
        secrets = [
            "fake-secret-for-tests",
            "fake-plugin-secret",
            "fake-override-secret",
            "fake-custom-secret",
            "fake-client-id-for-tests",
            "fake-plugin-client-id",
            "fake-override-client-id",
            "fake-custom-client",
        ]

        for scenario in scenarios:
            with self.subTest(scenario=scenario["id"]):
                if scenario.get("windows_only") and sys.platform != "win32":
                    self.skipTest("Windows-only scenario")

                fixture = None
                try:
                    fixture = build_fixture(scenario)
                    result = run_where(fixture["plugin_dir"], fixture["env"])

                    # Check result JSON for secrets
                    result_str = json.dumps(result)
                    for secret in secrets:
                        self.assertNotIn(
                            secret, result_str,
                            f"Secret '{secret}' leaked in scenario {scenario['id']} output"
                        )

                finally:
                    if fixture:
                        fixture["cleanup"]()
                        override_dir = fixture["env"].get("_override_dir")
                        if override_dir:
                            import shutil
                            shutil.rmtree(override_dir, ignore_errors=True)


class TestFixtureRefusesAuthState(unittest.TestCase):
    """Test that the fixture builder refuses existing auth state."""

    def test_refuses_existing_auth_state(self):
        """Test that the fixture builder refuses to run if the plugin tree
        already contains .env or tokens.json."""
        # Create a temp directory that looks like it has auth state
        fake_plugin = Path(tempfile.mkdtemp(prefix="outlook-fake-plugin-"))
        outlook_dir = fake_plugin / "outlook-skills"
        outlook_dir.mkdir(parents=True)
        (outlook_dir / ".env").write_text("OUTLOOK_CLIENT_ID=real-cred\n")

        try:
            # Test the assertion function directly
            from state_fixture import _assert_no_auth_state

            with self.assertRaises(RuntimeError) as ctx:
                _assert_no_auth_state(outlook_dir)

            self.assertIn(".env", str(ctx.exception))
            self.assertIn("real credentials", str(ctx.exception).lower())

        finally:
            import shutil
            shutil.rmtree(fake_plugin, ignore_errors=True)


class TestProbeReportsAbsolutePaths(unittest.TestCase):
    """--where must report absolute paths even when the overrides are relative."""

    def test_relative_overrides_are_reported_absolute(self):
        scenario = {"id": 104, "env": {}, "home": [], "plugin": [], "windows_only": False}
        fixture = build_fixture(scenario)
        try:
            env = dict(fixture["env"],
                       OUTLOOK_SKILLS_HOME="relative-state",
                       OUTLOOK_TOKEN_FILE="relative-tokens.json")
            cwd = fixture["home_dir"]
            result = run_where(fixture["plugin_dir"], env, cwd=cwd)

            self.assertEqual(result["state_dir"], str(Path(cwd).absolute() / "relative-state"))
            self.assertEqual(result["token_file"], str(Path(cwd).absolute() / "relative-tokens.json"))
            self.assertEqual(result["checked_dirs"], [result["state_dir"]])
        finally:
            fixture["cleanup"]()


if __name__ == "__main__":
    unittest.main()
