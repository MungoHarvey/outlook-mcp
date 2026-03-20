#!/usr/bin/env bash
# =============================================================================
# azure-auth/auth.sh
# Entry point for Azure OAuth authentication setup.
# Usage: bash auth.sh [--reauth] [--revoke] [--status]
#
# Bootstraps Python environment if needed, then delegates to auth_runner.py.
# The user never needs to interact with Python directly.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
REQUIREMENTS="$SCRIPT_DIR/requirements.txt"
RUNNER="$SCRIPT_DIR/auth_runner.py"
CONFIG_EXAMPLE="$SCRIPT_DIR/config.example.json"
SKILLS_DIR="$HOME/.skills"
CONFIG_FILE="$SKILLS_DIR/config.json"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Check Python ─────────────────────────────────────────────────────────────
check_python() {
    local python_cmd=""

    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            local version
            version=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
            local major minor
            major=$(echo "$version" | cut -d. -f1)
            minor=$(echo "$version" | cut -d. -f2)
            if [ "$major" -ge 3 ] && [ "$minor" -ge 8 ]; then
                python_cmd="$cmd"
                break
            fi
        fi
    done

    if [ -z "$python_cmd" ]; then
        error "Python 3.8+ is required but not found."
        echo ""
        echo "  macOS:   brew install python3"
        echo "  Ubuntu:  sudo apt install python3 python3-pip"
        echo "  Windows: https://www.python.org/downloads/"
        exit 1
    fi

    echo "$python_cmd"
}

# ── Bootstrap virtual environment ────────────────────────────────────────────
bootstrap_venv() {
    local python_cmd="$1"

    if [ ! -d "$VENV_DIR" ]; then
        info "Creating local Python environment..."
        "$python_cmd" -m venv "$VENV_DIR"
        success "Virtual environment created"
    fi

    # Activate
    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate" 2>/dev/null || \
        source "$VENV_DIR/Scripts/activate" 2>/dev/null || {
            error "Could not activate virtual environment"
            exit 1
        }

    # Install/upgrade dependencies quietly
    local needs_install=false
    if ! python -c "import keyring, cryptography" &>/dev/null 2>&1; then
        needs_install=true
    fi

    if [ "$needs_install" = true ]; then
        info "Installing dependencies (one-time, ~10 seconds)..."
        pip install --quiet --upgrade pip
        pip install --quiet -r "$REQUIREMENTS"
        success "Dependencies installed"
    fi
}

# ── Ensure ~/.skills/config.json exists ──────────────────────────────────────
ensure_config() {
    mkdir -p "$SKILLS_DIR"
    chmod 700 "$SKILLS_DIR"   # Only owner can read

    if [ ! -f "$CONFIG_FILE" ]; then
        warn "No config found at $CONFIG_FILE"
        echo ""
        echo "  Please create it from the template:"
        echo ""
        echo "    cp $CONFIG_EXAMPLE $CONFIG_FILE"
        echo "    # Then edit $CONFIG_FILE with your Azure app details"
        echo ""
        echo "  You need:"
        echo "    tenant_id   - from Azure portal > App registrations"
        echo "    client_id   - from Azure portal > App registrations"
        echo ""
        exit 1
    fi

    # Validate required fields are present
    if ! python3 - "$CONFIG_FILE" << 'PYEOF' 2>/dev/null
import json, sys
with open(sys.argv[1]) as f:
    cfg = json.load(f)
missing = [k for k in ['tenant_id','client_id'] if not cfg.get(k)]
if missing:
    print('Missing fields: ' + ', '.join(missing))
    sys.exit(1)
PYEOF
then
        error "config.json is missing required fields (tenant_id, client_id)"
        echo "  See $CONFIG_EXAMPLE for reference"
        exit 1
    fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    header "Azure Skills Authentication"
    echo "  Configures secure token storage for Outlook and Calendar skills."
    echo ""

    local python_cmd
    python_cmd=$(check_python)
    info "Using Python: $(command -v "$python_cmd") ($("$python_cmd" --version 2>&1))"

    bootstrap_venv "$python_cmd"
    ensure_config

    # Pass all arguments through to the Python runner
    python "$RUNNER" "$@"
}

main "$@"
