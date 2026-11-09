#!/usr/bin/env python3
"""
Canary test: verify that no test process loads real credentials.

Runs each of the four vulnerable test modules in a subprocess with a fake
"real home" whose .outlook-skills/.env contains a canary secret. A small
runner script prints at exit whether the canary was loaded. We assert it
prints False (canary NOT loaded) for each module.

Before the isolated_env bootstrap exists, this test MUST fail because
token_helper loads the canary .env at import time.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TEST_DIR = Path(__file__).parent

# The canary value that must NEVER appear in any test process environment
CANARY_SECRET = "CANARY-must-never-load"

# The four modules that import token_helper in-process
VULNERABLE_MODULES = [
    "env_refresh_test",
    "scope_drift_test",
    "token_persist_test",
    "token_refresh_test",
]

# Runner script that imports a test module and reports whether canary was loaded
# Note: Paths are passed via environment to avoid escaping issues
RUNNER_SCRIPT = """
import os
import sys
import importlib.util
from pathlib import Path

# Get paths from environment
module_name = os.environ["CANARY_MODULE"]
test_path = os.environ["CANARY_TEST_PATH"]
result_file = os.environ["CANARY_RESULT_FILE"]
canary_secret = os.environ["CANARY_SECRET"]

# Add test/python to path so isolated_env can be imported
test_dir = Path(test_path).parent
sys.path.insert(0, str(test_dir))

# First, check if canary is already in environ (would mean token_helper loaded it)
initial_canary = os.environ.get("OUTLOOK_CLIENT_SECRET") == canary_secret

# Now import the test module (which imports token_helper)
spec = importlib.util.spec_from_file_location(module_name, test_path)
test_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(test_module)

# Check again after import
post_import_canary = os.environ.get("OUTLOOK_CLIENT_SECRET") == canary_secret

# Report: True if canary was loaded at ANY point
loaded = initial_canary or post_import_canary
with open(result_file, "w") as f:
    f.write("LOADED_CANARY=" + ("1" if loaded else "0"))

# Run the tests
import unittest
loader = unittest.TestLoader()
suite = loader.loadTestsFromModule(test_module)
runner = unittest.TextTestRunner(stream=sys.stdout, verbosity=2)
result = runner.run(suite)

# Exit with appropriate code
sys.exit(0 if result.wasSuccessful() else 1)
"""


class RealEnvIsolationTest(unittest.TestCase):
    """Test that test processes never load the canary secret."""

    def setUp(self):
        # Create a temporary "real home" with canary .env
        self._real_home = Path(tempfile.mkdtemp(prefix="outlook-real-home-"))
        self._outlook_dir = self._real_home / ".outlook-skills"
        self._outlook_dir.mkdir(parents=True)
        
        # Write canary .env
        (self._outlook_dir / ".env").write_text(
            f"OUTLOOK_CLIENT_ID=fake-client-id\n"
            f"OUTLOOK_CLIENT_SECRET={CANARY_SECRET}\n"
            f"OUTLOOK_TENANT_ID=common\n"
        )
        
        # Create result file path
        self._result_file = Path(tempfile.mktemp(prefix="canary-result-"))

    def tearDown(self):
        # Clean up temp directories
        shutil.rmtree(self._real_home, ignore_errors=True)
        if self._result_file.exists():
            self._result_file.unlink()

    def test_module_does_not_load_canary(self, module_name="env_refresh_test"):
        """Run a single test module in subprocess and verify canary not loaded."""
        test_path = TEST_DIR / f"{module_name}.py"
        
        # Build environment: HOME/USERPROFILE point to our canary home
        env = os.environ.copy()
        env["HOME"] = str(self._real_home)
        env["USERPROFILE"] = str(self._real_home)
        # Clear any existing Outlook env vars
        for key in ("OUTLOOK_SKILLS_HOME", "OUTLOOK_TOKEN_FILE", 
                    "OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET", "OUTLOOK_TENANT_ID"):
            env.pop(key, None)
        # Pass canary test params via environment (avoids path escaping issues)
        env["CANARY_MODULE"] = module_name
        env["CANARY_TEST_PATH"] = str(test_path)
        env["CANARY_RESULT_FILE"] = str(self._result_file)
        env["CANARY_SECRET"] = CANARY_SECRET
        
        # Run the runner script
        result = subprocess.run(
            [sys.executable, "-c", RUNNER_SCRIPT],
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(REPO_ROOT),
        )
        
        # Read the canary result
        if self._result_file.exists():
            result_content = self._result_file.read_text().strip()
            loaded_canary = result_content == "LOADED_CANARY=1"
        else:
            # If no result file, something went wrong - check stderr
            self.fail(f"Result file not created. stderr: {result.stderr}")
        
        # Assert canary was NOT loaded
        self.assertFalse(
            loaded_canary,
            f"Module {module_name} loaded the canary secret!\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
        
        # Also verify tests passed
        self.assertEqual(
            result.returncode, 0,
            f"Tests in {module_name} failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )

    def test_env_refresh_test_isolation(self):
        self.test_module_does_not_load_canary("env_refresh_test")

    def test_scope_drift_test_isolation(self):
        self.test_module_does_not_load_canary("scope_drift_test")

    def test_token_persist_test_isolation(self):
        self.test_module_does_not_load_canary("token_persist_test")

    def test_token_refresh_test_isolation(self):
        self.test_module_does_not_load_canary("token_refresh_test")


if __name__ == "__main__":
    unittest.main()
