#!/usr/bin/env bash
# =============================================================================
# outlook-skills/auth.sh
# Entry point for Azure OAuth authentication setup.
# Usage: bash auth.sh [--reauth] [--revoke] [--status]
#
# Credentials: outlook-skills/.env  (copy from .env.example)
# Venv:        outlook-skills/.venv (created here, never in Claude dirs)
# Tokens:      outlook-skills/tokens.json (gitignored)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
REQUIREMENTS="$SCRIPT_DIR/requirements.txt"
RUNNER="$SCRIPT_DIR/auth_runner.py"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Bootstrap virtual environment ────────────────────────────────────────────
bootstrap_venv() {
    if command -v uv &>/dev/null; then
        info "Using uv"
        if [ ! -d "$VENV_DIR" ]; then
            info "Creating virtual environment..."
            uv venv "$VENV_DIR"
            success "Virtual environment created"
        fi
        # Activate
        # shellcheck disable=SC1091
        source "$VENV_DIR/bin/activate" 2>/dev/null || \
            source "$VENV_DIR/Scripts/activate" 2>/dev/null || {
                error "Could not activate virtual environment"
                exit 1
            }
        if ! python -c "import dotenv" &>/dev/null 2>&1; then
            info "Installing dependencies (one-time)..."
            uv pip install --quiet -r "$REQUIREMENTS"
            success "Dependencies installed"
        fi
    else
        # Fallback: plain pip
        local python_cmd=""
        for cmd in python3 python; do
            if command -v "$cmd" &>/dev/null; then
                local ver
                ver=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
                local major minor
                major=$(echo "$ver" | cut -d. -f1)
                minor=$(echo "$ver" | cut -d. -f2)
                if [ "$major" -ge 3 ] && [ "$minor" -ge 8 ]; then
                    python_cmd="$cmd"
                    break
                fi
            fi
        done
        if [ -z "$python_cmd" ]; then
            error "uv not found and Python 3.8+ not found."
            echo "  Install uv (recommended): https://docs.astral.sh/uv/getting-started/installation/"
            echo "  Or install Python 3.8+:   https://www.python.org/downloads/"
            exit 1
        fi
        warn "uv not found — falling back to pip (install uv for faster setup)"
        if [ ! -d "$VENV_DIR" ]; then
            info "Creating virtual environment..."
            "$python_cmd" -m venv "$VENV_DIR"
            success "Virtual environment created"
        fi
        # shellcheck disable=SC1091
        source "$VENV_DIR/bin/activate" 2>/dev/null || \
            source "$VENV_DIR/Scripts/activate" 2>/dev/null || {
                error "Could not activate virtual environment"
                exit 1
            }
        if ! python -c "import dotenv" &>/dev/null 2>&1; then
            info "Installing dependencies (one-time)..."
            pip install --quiet --upgrade pip
            pip install --quiet -r "$REQUIREMENTS"
            success "Dependencies installed"
        fi
    fi
}

# ── Ensure .env exists ────────────────────────────────────────────────────────
ensure_env() {
    if [ ! -f "$ENV_FILE" ]; then
        warn "No .env found at $ENV_FILE"
        echo ""
        echo "  Copy the template and fill in your Azure app credentials:"
        echo ""
        echo "    cp $ENV_EXAMPLE $ENV_FILE"
        echo "    # Edit $ENV_FILE — add OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID"
        echo ""
        exit 1
    fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    header "Azure Skills Authentication"
    echo "  Credentials: $ENV_FILE"
    echo "  Venv:        $VENV_DIR"
    echo ""

    ensure_env
    bootstrap_venv

    # Pass all arguments through to the Python runner
    python "$RUNNER" "$@"
}

main "$@"
