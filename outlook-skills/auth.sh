#!/usr/bin/env bash
# =============================================================================
# outlook-skills/auth.sh
# Entry point for Azure OAuth authentication.
# Delegates to auth-server.js (Node.js) — same approach as the MCP servers.
#
# Credentials: outlook-skills/.env  (copy from .env.example)
# Tokens:      outlook-skills/tokens.json (gitignored)
#
# Usage:
#   bash outlook-skills/auth.sh            # full auth flow
#   bash outlook-skills/auth.sh --status   # check token validity
#   bash outlook-skills/auth.sh --reauth   # force re-authentication
#   bash outlook-skills/auth.sh --revoke   # revoke and delete all tokens
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTH_SERVER="$SCRIPT_DIR/auth-server.js"
ENV_FILE="$SCRIPT_DIR/.env"

echo ""
echo "Azure Skills Authentication"
echo "  Credentials: $ENV_FILE"
echo ""

# -- Validate .env exists ---------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
    echo "[warn] No .env found at $ENV_FILE"
    echo ""
    echo "  Copy the template and fill in your Azure app credentials:"
    echo "    cp $SCRIPT_DIR/.env.example $ENV_FILE"
    echo ""
    exit 1
fi
echo "  [ok] Credentials file found"

# -- Check Node.js is available ---------------------------------------------
if ! command -v node &>/dev/null; then
    echo "[error] Node.js is required but not found. Install from: https://nodejs.org/"
    exit 1
fi
echo "  [ok] Node.js found: $(node --version)"
echo ""

# -- Delegate to Node.js auth server ----------------------------------------
node "$AUTH_SERVER" "$@"
