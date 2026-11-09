#!/usr/bin/env python3
"""
Shared bootstrap for isolating test environment from real auth state.

Import this module BEFORE importing token_helper in any test that should
not load real credentials. It:

  - Creates a temp directory for OUTLOOK_SKILLS_HOME
  - Sets HOME and USERPROFILE to a temp "home" with no auth state
  - Removes inherited Outlook-related env vars
  - Raises if token_helper is already in sys.modules (too late)

Usage in test modules:
    import isolated_env  # MUST be before token_helper
    import token_helper  # noqa: E402
"""
import os
import shutil
import sys
import tempfile
from pathlib import Path

# Check if token_helper is already imported - if so, isolation is too late
if "token_helper" in sys.modules:
    raise RuntimeError(
        "token_helper already imported - isolated_env must be imported first. "
        "The order matters because token_helper resolves STATE_DIR at import time."
    )

# Create temp directories for isolation
_temp_home = Path(tempfile.mkdtemp(prefix="outlook-test-home-"))
_temp_state_dir = Path(tempfile.mkdtemp(prefix="outlook-test-state-"))

# Store cleanup function for tests that need it
def cleanup():
    """Clean up temp directories. Call in tearDown if needed."""
    shutil.rmtree(_temp_home, ignore_errors=True)
    shutil.rmtree(_temp_state_dir, ignore_errors=True)

# Set HOME and USERPROFILE to temp home with no auth state
os.environ["HOME"] = str(_temp_home)
os.environ["USERPROFILE"] = str(_temp_home)

# Set OUTLOOK_SKILLS_HOME to empty temp state dir (no .env, no tokens.json)
os.environ["OUTLOOK_SKILLS_HOME"] = str(_temp_state_dir)

# Remove any inherited Outlook-related env vars that could leak real credentials
for key in ("OUTLOOK_TOKEN_FILE", "OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET", 
            "OUTLOOK_TENANT_ID"):
    os.environ.pop(key, None)

# Export paths for tests that need to know them
TEST_HOME = _temp_home
TEST_STATE_DIR = _temp_state_dir
