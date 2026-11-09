#!/usr/bin/env python3
"""
Fixture builder for state directory lookup tests.

Creates isolated temporary plugin trees and home directories for testing
the token_helper.py state resolution logic without touching real credentials.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# Allowlist of files to copy from the repo into the fixture plugin tree.
# Never copy the whole checkout — we want a minimal, controlled environment.
ALLOWLIST = [
    "outlook-skills/token_helper.py",
    "outlook-skills/scopes.json",
    "outlook-skills/.env.example",
    "outlook-skills/auth.sh",
    "outlook-skills/auth.ps1",
]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _assert_no_auth_state(plugin_dir: Path) -> None:
    """Assert the plugin directory has no .env or tokens.json files."""
    env_file = plugin_dir / ".env"
    tokens_file = plugin_dir / "tokens.json"
    if env_file.exists():
        raise RuntimeError(
            f"Fixture plugin tree already contains .env at {env_file}. "
            "Refusing to run tests with real credentials present."
        )
    if tokens_file.exists():
        raise RuntimeError(
            f"Fixture plugin tree already contains tokens.json at {tokens_file}. "
            "Refusing to run tests with real credentials present."
        )


def build_fixture(scenario: dict) -> dict:
    """
    Build a temporary fixture for a single scenario.

    Args:
        scenario: A row from state-dir-scenarios.json

    Returns:
        A dict with:
          - plugin_dir: Path to the temp plugin tree
          - home_dir: Path to the temp home directory
          - env: Environment dict for subprocess calls
          - cleanup: Callable to clean up temp dirs
    """
    # Create temp directories
    plugin_dir = Path(tempfile.mkdtemp(prefix="outlook-fixture-plugin-"))
    home_dir = Path(tempfile.mkdtemp(prefix="outlook-fixture-home-"))

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

        # Assert no auth state in the fixture before adding synthetic files
        outlook_skills_dir = plugin_dir / "outlook-skills"
        _assert_no_auth_state(outlook_skills_dir)

        # Create synthetic state files in home/.outlook-skills and/or plugin
        home_files = scenario.get("home", [])
        plugin_files = scenario.get("plugin", [])

        # State files go under ~/.outlook-skills, not directly in home
        home_state_dir = home_dir / ".outlook-skills"
        home_state_dir.mkdir(parents=True, exist_ok=True)

        for fname in home_files:
            fpath = home_state_dir / fname
            if fname == ".env":
                fpath.write_text(
                    "OUTLOOK_CLIENT_ID=fake-client-id-for-tests\n"
                    "OUTLOOK_CLIENT_SECRET=fake-secret-for-tests\n"
                )
            elif fname == "tokens.json":
                fpath.write_text(json.dumps({
                    "access_token": "fake-access-token-for-tests",
                    "refresh_token": "fake-refresh-token-for-tests",
                    "client_id": "fake-client-id-for-tests",
                    "client_secret": "fake-secret-for-tests",
                    "session_started_at": 0,
                    "access_token_expires_at": 9999999999,
                }))

        for fname in plugin_files:
            fpath = outlook_skills_dir / fname
            if fname == ".env":
                fpath.write_text(
                    "OUTLOOK_CLIENT_ID=fake-plugin-client-id\n"
                    "OUTLOOK_CLIENT_SECRET=fake-plugin-secret\n"
                )
            elif fname == "tokens.json":
                fpath.write_text(json.dumps({
                    "access_token": "fake-plugin-access-token",
                    "refresh_token": "fake-plugin-refresh-token",
                    "client_id": "fake-plugin-client-id",
                    "client_secret": "fake-plugin-secret",
                    "session_started_at": 0,
                    "access_token_expires_at": 9999999999,
                }))

        # Build environment for subprocess
        env = os.environ.copy()
        # Hermetic: a developer's exported credentials or overrides must not reach the probe
        for key in ("OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET", "OUTLOOK_SKILLS_HOME", "OUTLOOK_TOKEN_FILE"):
            env.pop(key, None)
        env_vars = scenario.get("env", {})

        # Set HOME and USERPROFILE based on scenario
        # Row 10 sets them differently; otherwise they're the same
        if scenario.get("id") == 10:
            # Windows-specific: HOME != USERPROFILE, state under USERPROFILE
            env["HOME"] = str(home_dir) + "_different"  # Different path
            env["USERPROFILE"] = str(home_dir)
        else:
            env["HOME"] = str(home_dir)
            env["USERPROFILE"] = str(home_dir)

        # Apply scenario env overrides
        for key, value in env_vars.items():
            if value == "<override>":
                # Use a distinct override directory
                override_dir = Path(tempfile.mkdtemp(prefix="outlook-fixture-override-"))
                (override_dir / ".env").write_text(
                    "OUTLOOK_CLIENT_ID=fake-override-client-id\n"
                    "OUTLOOK_CLIENT_SECRET=fake-override-secret\n"
                )
                (override_dir / "tokens.json").write_text(json.dumps({
                    "access_token": "fake-override-access-token",
                    "refresh_token": "fake-override-refresh-token",
                    "client_id": "fake-override-client-id",
                    "client_secret": "fake-override-secret",
                    "session_started_at": 0,
                    "access_token_expires_at": 9999999999,
                }))
                env[key] = str(override_dir)
                # Store for cleanup
                env["_override_dir"] = str(override_dir)
            elif value == "":
                env[key] = ""
            elif value == "<tokenfile>":
                # Custom token file path
                token_file = home_dir / "custom-tokens.json"
                token_file.write_text(json.dumps({
                    "access_token": "fake-custom-token",
                    "refresh_token": "fake-custom-refresh",
                    "client_id": "fake-custom-client",
                    "client_secret": "fake-custom-secret",
                    "session_started_at": 0,
                    "access_token_expires_at": 9999999999,
                }))
                env[key] = str(token_file)
            else:
                env[key] = value

        return {
            "plugin_dir": plugin_dir,
            "home_dir": home_dir,
            "env": env,
            "cleanup": cleanup,
        }

    except Exception:
        cleanup()
        raise


def run_where(plugin_dir: Path, env: dict, cwd: Path = None) -> dict:
    """
    Run `python token_helper.py --where` as a subprocess and parse the JSON output.

    Args:
        plugin_dir: Path to the fixture's plugin tree
        env: Environment dict for the subprocess
        cwd: Working directory for the subprocess (relative overrides resolve here)

    Returns:
        Parsed JSON dict from --where output
    """
    helper_path = plugin_dir / "outlook-skills" / "token_helper.py"
    result = subprocess.run(
        [sys.executable, str(helper_path), "--where"],
        env=env,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"--where failed with exit code {result.returncode}\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return json.loads(result.stdout)


def get_expected_paths(scenario: dict, fixture: dict) -> dict:
    """
    Compute expected absolute paths for a scenario.

    Args:
        scenario: The scenario row
        fixture: The built fixture dict

    Returns:
        Dict with state_dir, token_file and checked_dirs as absolute path strings
    """
    home_dir = fixture["home_dir"]
    plugin_dir = fixture["plugin_dir"] / "outlook-skills"
    env = fixture["env"]

    # State dir is ~/.outlook-skills, not ~ directly
    home_var = "USERPROFILE" if sys.platform == "win32" else "HOME"
    paths = {
        "override": Path(env.get("OUTLOOK_SKILLS_HOME", "")),
        "plugin": plugin_dir,
        "home": Path(env.get(home_var, str(home_dir))) / ".outlook-skills",
    }
    state_dir = paths[scenario.get("expected_state_dir", "home")]

    # Determine expected token_file
    expected_token = scenario.get("expected_token_file")
    if expected_token == "override":
        token_file = Path(env.get("OUTLOOK_TOKEN_FILE", ""))
    else:  # "state_dir"
        token_file = state_dir / "tokens.json"

    return {
        "state_dir": str(state_dir),
        "token_file": str(token_file),
        "checked_dirs": [str(paths[d]) for d in scenario["expected_checked_dirs"]],
    }
