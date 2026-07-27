#!/usr/bin/env bash
# =============================================================================
# setup/package.sh
# Creates a distributable zip of Outlook skills for import into Claude Desktop
# or Claude Cowork.
#
# Zip structure:
#   outlook-skills/
#     SKILLS.md               — overview and usage guide
#     outlook-auth/           — skill folders at root level
#     outlook-base/
#     outlook-email-list/
#     ... (all skill folders)
#
# Usage:
#   bash setup/package.sh
#
# Override default auth install path (used for path rewriting in skill files):
#   INSTALL_DIR=/custom/path bash setup/package.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Default: bake paths pointing to this repo (developer workflow, machine-specific).
# Override: INSTALL_DIR=/other/path bash setup/package.sh
INSTALL_DIR="${INSTALL_DIR:-$ROOT_DIR}"

PKG_NAME="outlook-skills"
OUTPUT="$ROOT_DIR/$PKG_NAME.zip"
TMP="$(mktemp -d)"
PKG_DIR="$TMP/$PKG_NAME"

mkdir -p "$PKG_DIR"

# ── Sanitise install path for sed (escape \, &, | metacharacters) ─────────────
_safe_dir="${INSTALL_DIR//\\/\\\\}"
_safe_dir="${_safe_dir//&/\\&}"
_safe_dir="${_safe_dir//|/\\|}"

echo "Packaging Outlook skills..."
echo "  Output:    $OUTPUT"
echo "  Auth path: $INSTALL_DIR"
echo ""

# ── SKILLS.md overview ────────────────────────────────────────────────────────
cp "$SCRIPT_DIR/SKILLS.md" "$PKG_DIR/SKILLS.md"

# ── Skill folders (flat — skills/ at repo root) ──────────────────────────────
for dir in "$ROOT_DIR/skills"/outlook-*/; do
    name=$(basename "$dir")
    dest="$PKG_DIR/$name"
    cp -r "$dir" "$dest"
    # Rewrite ${CLAUDE_PLUGIN_ROOT} paths to absolute installed locations
    find "$dest" -name "*.md" -exec sed -i \
        -e "s|\${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py|$_safe_dir/scripts/graph_call.py|g" \
        -e "s|\${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh|$_safe_dir/outlook-skills/auth.sh|g" \
        -e "s|\${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.ps1|$_safe_dir/outlook-skills/auth.ps1|g" \
        -e "s|\${CLAUDE_PLUGIN_ROOT}/setup/azure-setup-guide.html|$_safe_dir/setup/azure-setup-guide.html|g" {} \;
done

# ── Create zip ────────────────────────────────────────────────────────────────
(cd "$TMP" && zip -qr "$OUTPUT" "$PKG_NAME/")
rm -rf "$TMP"

echo "Created: $(basename "$OUTPUT")"
echo ""
echo "Import into Claude Desktop or Claude Cowork via:"
echo "  Settings → Skills → Import from zip"
echo ""
echo "Before importing, install the auth system if not already done:"
echo "  bash setup/install.sh"
echo "  bash $INSTALL_DIR/outlook-skills/auth.sh"
