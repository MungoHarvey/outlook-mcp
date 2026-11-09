#!/usr/bin/env bash
# =============================================================================
# outlook-skills/auth.sh
# Thin launcher for Azure OAuth authentication.
# Delegates entirely to auth-server.js — no state resolution or .env checks here.
#
# Usage:
#   bash outlook-skills/auth.sh            # full auth flow
#   bash outlook-skills/auth.sh --status   # check token validity
#   bash outlook-skills/auth.sh --reauth   # force re-authentication
#   bash outlook-skills/auth.sh --revoke   # revoke and delete all tokens
#   bash outlook-skills/auth.sh --where    # print state directory info as JSON
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTH_SERVER="$SCRIPT_DIR/auth-server.js"

# -- Check Node.js is available ---------------------------------------------
if ! command -v node &>/dev/null; then
    echo "[error] Node.js is required but not found. Install from: https://nodejs.org/"
    exit 1
fi

# -- Map flags and delegate to auth-server.js -------------------------------
# Pass through bash-style flags directly; auth-server.js handles them.
exec node "$AUTH_SERVER" "$@"
