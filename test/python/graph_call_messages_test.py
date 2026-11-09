#!/usr/bin/env python3
"""
graph_call_messages_test.py — Test that graph_call.py returns the helper's
full auth error messages (checked dirs + platform-correct command).

These tests run graph_call.py as a subprocess with a fixture environment
(temp HOME/USERPROFILE, no inherited OUTLOOK_* variables). They never import
token_helper or graph_call into the test process.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

# Reuse the fixture builder pattern from state_fixture.py
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ALLOWLIST = [
    "scripts/graph_call.py",
    "outlook-skills/token_helper.py",
    "outlook-skills/scopes.json",
    "outlook-skills/.env.example",
    "outlook-skills/auth.sh",
    "outlook-skills/auth.ps1",
]


def build_graph_call_fixture():
    """Build a minimal fixture for graph_call.py testing."""
    plugin_dir = Path(tempfile.mkdtemp(prefix="outlook-fixture-gc-"))
    home_dir = Path(tempfile.mkdtemp(prefix="outlook-fixture-home-gc-"))

    def cleanup():
        shutil.rmtree(plugin_dir, ignore_errors=True)
        shutil.rmtree(home_dir, ignore_errors=True)

    try:
        # Copy allowlisted files only
        for rel_path in ALLOWLIST:
            src = REPO_ROOT / rel_path
            if not src.exists():
                raise RuntimeError(f"Allowlisted file not found: {src}")
            dst = plugin_dir / rel_path
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

        # Build environment for subprocess (no inherited OUTLOOK_* vars)
        env = os.environ.copy()
        for key in ("OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET",
                    "OUTLOOK_SKILLS_HOME", "OUTLOOK_TOKEN_FILE"):
            env.pop(key, None)
        env["HOME"] = str(home_dir)
        env["USERPROFILE"] = str(home_dir)

        return {
            "plugin_dir": plugin_dir,
            "home_dir": home_dir,
            "env": env,
            "cleanup": cleanup,
        }
    except Exception:
        cleanup()
        raise


class TestGraphCallAuthMessages(unittest.TestCase):
    """Test that graph_call.py returns full auth error messages."""

    def setUp(self):
        """Build fixture with no token file (no auth state)."""
        self.fixture = build_graph_call_fixture()

    def tearDown(self):
        """Clean up temp directories."""
        self.fixture["cleanup"]()

    def test_no_token_file_returns_helper_message(self):
        """When no token file exists, error contains checked dirs and exact command."""
        graph_call_path = self.fixture["plugin_dir"] / "scripts" / "graph_call.py"

        result = subprocess.run(
            [sys.executable, str(graph_call_path), "GET", "/me"],
            env=self.fixture["env"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        # Exit code should indicate auth failure (not a crash)
        self.assertEqual(result.returncode, 0,
                         f"graph_call.py should exit 0 even on auth error. stderr: {result.stderr}")

        # Parse JSON output
        output = json.loads(result.stdout)

        # Should have auth_required error
        self.assertEqual(output.get("status"), 401,
                         f"Expected status 401, got: {output}")
        self.assertEqual(output.get("error"), "auth_required",
                         f"Expected error 'auth_required', got: {output}")

        # The message is the helper's text exactly: checked dirs in order (home
        # state dir, then the plugin's outlook-skills dir), then the platform command.
        home_state_dir = self.fixture["home_dir"] / ".outlook-skills"
        skills_dir = self.fixture["plugin_dir"] / "outlook-skills"
        if sys.platform == "win32":
            cmd = f'powershell -NoProfile -File "{skills_dir / "auth.ps1"}" -Reauth'
        else:
            cmd = f'bash "{skills_dir / "auth.sh"}" --reauth'
        expected = (f"No token file found. Checked: {home_state_dir}; {skills_dir}. "
                    f"Run: {cmd}")
        self.assertEqual(output.get("message"), expected)

        # Message must NOT contain any fake secrets
        self.assertNotIn("fake-secret", output["message"].lower(),
                         f"Message should not contain secrets. Got: {output}")

    def test_expired_token_no_env_copy_env_message(self):
        """When token exists but .env is missing, message says 'Copy your existing .env'."""
        # Create an expired token file (session_started_at = 0, so > 30 days old)
        home_state_dir = self.fixture["home_dir"] / ".outlook-skills"
        home_state_dir.mkdir(parents=True, exist_ok=True)

        import time
        # Valid session (started recently) but expired access token
        # This triggers refresh, which fails due to missing client_secret
        expired_tokens = {
            "access_token": "fake-expired-access-token",
            "refresh_token": "fake-expired-refresh-token",
            "client_id": "fake-client-id",
            # No client_secret in tokens.json — must come from .env
            "session_started_at": time.time() - 1000,  # Session is valid (< 30 days)
            "access_token_expires_at": time.time() - 1000,  # Access token expired
        }
        (home_state_dir / "tokens.json").write_text(json.dumps(expired_tokens))

        # Explicitly ensure NO .env file exists
        env_file = home_state_dir / ".env"
        if env_file.exists():
            env_file.unlink()

        # Network is blocked: if the proxy reaches urlopen, the stub raises and the
        # exact-message assertion below fails.
        wrapper_script = self.fixture["plugin_dir"] / "test_block_network_wrapper.py"
        graph_call_path = self.fixture["plugin_dir"] / "scripts" / "graph_call.py"
        wrapper_script.write_text(
            "import runpy, sys\n"
            "import urllib.request\n"
            "def blocked_urlopen(req, timeout=None):\n"
            "    raise RuntimeError('network blocked in test')\n"
            "urllib.request.urlopen = blocked_urlopen\n"
            "sys.argv = ['graph_call.py', 'GET', '/me']\n"
            f"runpy.run_path({str(graph_call_path)!r}, run_name='__main__')\n"
        )

        result = subprocess.run(
            [sys.executable, str(wrapper_script)],
            env=self.fixture["env"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        self.assertEqual(result.returncode, 0,
                         f"graph_call.py should exit 0 on auth error. stderr: {result.stderr}")

        output = json.loads(result.stdout)

        # Refresh is refused before any request: no client_secret in tokens.json or .env
        self.assertEqual(output.get("error"), "auth_required",
                         f"Expected auth_required, got: {output}")
        if sys.platform == "win32":
            cmd = f'powershell -NoProfile -File "{self.fixture["plugin_dir"] / "outlook-skills" / "auth.ps1"}" -Reauth'
        else:
            cmd = f'bash "{self.fixture["plugin_dir"] / "outlook-skills" / "auth.sh"}" --reauth'
        expected = (f"client_secret not found. Checked: {home_state_dir}. "
                    f"Copy your existing .env to {home_state_dir}, then run: {cmd}")
        self.assertEqual(output.get("message"), expected)

        # The exact message above has no Azure-app registration advice at all, so
        # "Copy your existing .env" trivially precedes it. Check for no secrets.
        self.assertNotIn("fake-secret", output["message"].lower(),
                         f"Message should not contain secrets. Got: {output}")

    def test_malformed_tokens_json_fake_token_not_in_message(self):
        """When tokens.json is malformed JSON, fake token text appears in no message."""
        home_state_dir = self.fixture["home_dir"] / ".outlook-skills"
        home_state_dir.mkdir(parents=True, exist_ok=True)

        # Write malformed JSON containing a fake token-like string (JWT format)
        fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.token"
        (home_state_dir / "tokens.json").write_text(fake_token)

        graph_call_path = self.fixture["plugin_dir"] / "scripts" / "graph_call.py"

        result = subprocess.run(
            [sys.executable, str(graph_call_path), "GET", "/me"],
            env=self.fixture["env"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        self.assertEqual(result.returncode, 0,
                         f"graph_call.py should exit 0 on auth error. stderr: {result.stderr}")

        output = json.loads(result.stdout)

        # Should have auth_required error
        self.assertEqual(output.get("status"), 401,
                         f"Expected status 401, got: {output}")
        self.assertEqual(output.get("error"), "auth_required",
                         f"Expected error 'auth_required', got: {output}")

        # Message must NOT contain any part of the fake token (JWT prefix is distinctive)
        message = output.get("message", "")
        self.assertNotIn("eyJhbGciOi", message,
                         f"Message should not contain any part of the fake token. Got: {message}")
        # Should use fixed description instead of raw parser error
        self.assertIn("not valid JSON", message,
                      f"Message should use fixed 'not valid JSON' description. Got: {message}")
        self.assertNotIn("Unexpected token", message,
                         f"Message should not include raw parser error. Got: {message}")


class TestGraphCallImportError(unittest.TestCase):
    """Test that graph_call.py handles token_helper import errors correctly."""

    def setUp(self):
        """Build fixture, then break token_helper import."""
        self.fixture = build_graph_call_fixture()
        # Remove token_helper.py to simulate import error
        token_helper = self.fixture["plugin_dir"] / "outlook-skills" / "token_helper.py"
        if token_helper.exists():
            token_helper.unlink()

    def tearDown(self):
        self.fixture["cleanup"]()

    def test_import_error_shows_platform_command(self):
        """When token_helper cannot be imported, show platform-correct command."""
        graph_call_path = self.fixture["plugin_dir"] / "scripts" / "graph_call.py"

        result = subprocess.run(
            [sys.executable, str(graph_call_path), "GET", "/me"],
            env=self.fixture["env"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        # Should exit with error code for import failure
        self.assertEqual(result.returncode, 1,
                         f"graph_call.py should exit 1 on import error. stderr: {result.stderr}")

        # Parse JSON output
        output = json.loads(result.stdout)

        self.assertEqual(output.get("status"), 503,
                         f"Expected status 503, got: {output}")
        self.assertEqual(output.get("error"), "import_error",
                         f"Expected error 'import_error', got: {output}")

        message = output.get("message", "")

        # The exact runnable command, quoted path included: substring checks
        # let a missing closing quote through.
        skills_dir = self.fixture["plugin_dir"] / "outlook-skills"
        if sys.platform == "win32":
            expected = f'powershell -NoProfile -File "{skills_dir / "auth.ps1"}" -Reauth'
        else:
            expected = f'bash "{skills_dir / "auth.sh"}" --reauth'
        self.assertTrue(message.endswith(f"Run: {expected}"),
                        f"Expected message to end with 'Run: {expected}'. Got: {message}")


class TestGraphCallSecond401Message(unittest.TestCase):
    """Test that graph_call.py second-401 message includes checked directories."""

    def setUp(self):
        """Build fixture with valid (unexpired) token."""
        self.fixture = build_graph_call_fixture()
        # Create a valid unexpired token so we reach the second-401 path
        home_state_dir = self.fixture["home_dir"] / ".outlook-skills"
        home_state_dir.mkdir(parents=True, exist_ok=True)
        import time
        valid_tokens = {
            "access_token": "fake-valid-token",
            "refresh_token": "fake-refresh-token",
            "client_id": "fake-client",
            "tenant_id": "common",
            "session_started_at": time.time() - 1000,  # Valid session
            "access_token_expires_at": time.time() + 3600,  # Unexpired token
        }
        (home_state_dir / "tokens.json").write_text(json.dumps(valid_tokens))
        # Also need .env for refresh to attempt (but fetch will fail)
        (home_state_dir / ".env").write_text("OUTLOOK_CLIENT_SECRET=fake-secret\n")

    def tearDown(self):
        self.fixture["cleanup"]()

    def test_second_401_message_includes_checked_dirs(self):
        """When Graph returns 401 twice, message includes checked directories."""
        # Create a wrapper script that stubs urlopen to raise HTTPError 401 twice
        # for Graph API calls only (allow token refresh to succeed with fake response)
        wrapper_script = self.fixture["plugin_dir"] / "test_401_wrapper.py"
        graph_call_path = self.fixture["plugin_dir"] / "scripts" / "graph_call.py"
        # Use forward slashes for the path to avoid escape sequence issues in Python
        graph_call_path_str = str(graph_call_path).replace('\\', '/')
        wrapper_code = f'''import sys
import json
import urllib.request
import urllib.error
from io import BytesIO

_call_count = [0]

def mock_urlopen(req, timeout=None):
    # Only mock Graph API calls (graph.microsoft.com), allow token refresh to succeed
    if "graph.microsoft.com" in req.full_url:
        _call_count[0] += 1
        fp = BytesIO(b'{{"error": {{"code": "InvalidAuthenticationToken"}}}}')
        hdrs = {{}}
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", hdrs, fp)
    # For token refresh endpoint, return a fake success response
    elif "login.microsoftonline.com" in req.full_url:
        fp = BytesIO(b'{{"access_token": "fake-new-token", "expires_in": 3600, "refresh_token": "fake-refresh"}}')
        hdrs = {{"Content-Type": "application/json"}}
        return urllib.request.addinfourl(fp, hdrs, req.full_url)
    else:
        raise urllib.error.URLError(f"Unexpected URL: {{req.full_url}}")
urllib.request.urlopen = mock_urlopen

# Now run graph_call via runpy
import runpy
sys.argv = ["graph_call.py", "GET", "/me"]
runpy.run_path(r"{graph_call_path_str}", run_name="__main__")
'''
        (wrapper_script).write_text(wrapper_code)

        result = subprocess.run(
            [sys.executable, str(wrapper_script)],
            env=self.fixture["env"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        self.assertEqual(result.returncode, 0,
                         f"graph_call.py should exit 0 on auth error. stderr: {result.stderr}")

        output = json.loads(result.stdout)

        # Should have auth_required error from second 401
        self.assertEqual(output.get("status"), 401,
                         f"Expected status 401, got: {output}")
        self.assertEqual(output.get("error"), "auth_required",
                         f"Expected error 'auth_required', got: {output}")

        # The whole message, exactly: the second-401 lead-in, the checked directories
        # the lookup examined (it stops at the home state dir, which holds the token
        # file), then the platform command. A refresh failure shares the "Checked:"
        # and "Run:" parts, so only the lead-in tells the two paths apart.
        home_state_dir = self.fixture["home_dir"] / ".outlook-skills"
        skills_dir = self.fixture["plugin_dir"] / "outlook-skills"
        if sys.platform == "win32":
            expected_cmd = f'powershell -NoProfile -File "{skills_dir / "auth.ps1"}" -Reauth'
        else:
            expected_cmd = f'bash "{skills_dir / "auth.sh"}" --reauth'
        expected = (f"Token rejected after refresh. Checked: {home_state_dir}. "
                    f"Run: {expected_cmd}")
        self.assertEqual(output.get("message"), expected)


class TestGraphCall403Message(unittest.TestCase):
    """Test that graph_call.py returns correct 403 missing-scope message."""

    def setUp(self):
        """Build fixture with valid token but missing scopes."""
        self.fixture = build_graph_call_fixture()
        # Create a valid token with missing scopes
        home_state_dir = self.fixture["home_dir"] / ".outlook-skills"
        home_state_dir.mkdir(parents=True, exist_ok=True)
        import time
        valid_tokens = {
            "access_token": "fake-valid-token",
            "refresh_token": "fake-refresh-token",
            "client_id": "fake-client",
            "client_secret": "fake-secret",
            "session_started_at": time.time() - 1000,  # Valid session
            "access_token_expires_at": time.time() + 3600,  # Valid token
            "scopes": ["User.Read"],  # Missing required scopes
        }
        (home_state_dir / "tokens.json").write_text(json.dumps(valid_tokens))

    def tearDown(self):
        self.fixture["cleanup"]()

    def test_403_missing_scope_shows_platform_command(self):
        """When Graph returns 403 with missing scopes, message has platform-correct command."""
        # Create a wrapper script that stubs urlopen to return 403
        wrapper_script = self.fixture["plugin_dir"] / "test_403_wrapper.py"
        wrapper_code = '''import sys
import json
import urllib.request
import urllib.error
from io import BytesIO

# Stub urlopen to raise HTTPError 403
def mock_urlopen(req, timeout=None):
    fp = BytesIO(b'{"error": {"code": "Forbidden", "message": "Missing scope"}}')
    hdrs = {}
    raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", hdrs, fp)
urllib.request.urlopen = mock_urlopen

# Now run graph_call via runpy
import runpy
sys.argv = ["graph_call.py", "GET", "/me"]
try:
    runpy.run_path("scripts/graph_call.py", run_name="__main__")
except SystemExit as e:
    sys.exit(e.code)
'''
        wrapper_script.write_text(wrapper_code)

        result = subprocess.run(
            [sys.executable, str(wrapper_script)],
            env=self.fixture["env"],
            cwd=self.fixture["plugin_dir"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        # A handled 403 is a normal JSON reply: graph_call exits 0.
        self.assertEqual(result.returncode, 0,
                         f"graph_call should exit 0 on a handled 403. stderr: {result.stderr}")
        output_lines = result.stdout.strip().split('\n')
        output = json.loads(output_lines[-1])

        self.assertEqual(output.get("status"), 403,
                         f"Expected status 403, got: {output}")

        message = output.get("message", "")

        # The exact runnable command, quoted path included: substring checks
        # let a relative or unquoted command through.
        skills_dir = self.fixture["plugin_dir"] / "outlook-skills"
        if sys.platform == "win32":
            expected = f'powershell -NoProfile -File "{skills_dir / "auth.ps1"}" -Reauth'
        else:
            expected = f'bash "{skills_dir / "auth.sh"}" --reauth'
        self.assertTrue(message.endswith(f"Run: {expected}"),
                        f"Expected message to end with 'Run: {expected}'. Got: {message}")

        # Should NOT contain secrets
        self.assertNotIn("fake-secret", message.lower(),
                         f"Message should not contain secrets. Got: {message}")


if __name__ == "__main__":
    unittest.main()
