#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="${SKILLS_DIR:-$HOME/.claude/skills}"

# Default: auth and proxy live in the cloned repo (self-contained developer workflow).
# Override: INSTALL_DIR=/other/path bash setup/install.sh
INSTALL_DIR="${INSTALL_DIR:-$ROOT_DIR}"

# 1. Create skills directory
mkdir -p "$SKILLS_DIR"

# 2. Install skill folders — rewrite relative paths to repo locations
# Sanitize INSTALL_DIR for sed replacement strings (escape \, &, | metacharacters)
_safe_dir="${INSTALL_DIR//\\/\\\\}"
_safe_dir="${_safe_dir//&/\\&}"
_safe_dir="${_safe_dir//|/\\|}"

for dir in "$ROOT_DIR/skills"/outlook-*/; do
  name=$(basename "$dir")
  dest="$SKILLS_DIR/$name"
  # Remove any previous install first — copying into an existing dir would nest
  # a duplicate skill folder inside it (cp copies INTO an existing destination)
  rm -rf "$dest"
  cp -r "$dir" "$dest"
  # Rewrite ${CLAUDE_PLUGIN_ROOT} paths to absolute installed locations
  find "$dest" -name "*.md" -exec sed -i \
    -e "s|\${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py|$_safe_dir/scripts/graph_call.py|g" \
    -e "s|\${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh|$_safe_dir/outlook-skills/auth.sh|g" \
    -e "s|\${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.ps1|$_safe_dir/outlook-skills/auth.ps1|g" \
    -e "s|\${CLAUDE_PLUGIN_ROOT}/setup/azure-setup-guide.html|$_safe_dir/setup/azure-setup-guide.html|g" {} \;
done

# 3. Bootstrap venv (no-op if already done)
if ! bash "$INSTALL_DIR/outlook-skills/auth.sh" --status 2>/dev/null; then
    echo "[warn]  auth.sh --status failed (auth may not be set up yet)"
fi

echo "Outlook skills installed"
echo "  Skills: $SKILLS_DIR/outlook-*"
echo "  Proxy:  $INSTALL_DIR/scripts/graph_call.py"
echo ""
echo "Next step -- authenticate. Choose one:"
echo "  bash / macOS / Linux:   bash $INSTALL_DIR/outlook-skills/auth.sh"
echo "  PowerShell (Windows):   .\\outlook-skills\\auth.ps1"
