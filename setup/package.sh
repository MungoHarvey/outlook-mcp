#!/usr/bin/env bash
# =============================================================================
# setup/package.sh
# Creates a distributable zip of Outlook skills.
#
# The zip is structured to unzip directly into ~/ — no installer needed:
#   unzip outlook-skills-YYYYMMDD.zip -d ~/
#   bash ~/.skills/outlook-mcp/outlook-skills/auth.sh
#
# Override default install paths via environment variables:
#   INSTALL_DIR=/custom/path SKILLS_DIR=/custom/skills bash setup/package.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Paths relative to ~ (used for zip structure and path rewriting)
_INSTALL_REL="${INSTALL_DIR_REL:-.skills/outlook-mcp}"
_SKILLS_REL="${SKILLS_DIR_REL:-.claude/skills}"

# Absolute paths (for path rewriting inside skill .md files)
ABS_INSTALL="$HOME/$_INSTALL_REL"
ABS_SKILLS="$HOME/$_SKILLS_REL"

VERSION="$(date +%Y%m%d)"
OUTPUT="$ROOT_DIR/outlook-skills-$VERSION.zip"
TMP="$(mktemp -d)"

# ── Sanitise install path for sed (escape \, &, | metacharacters) ─────────────
_safe_dir="${ABS_INSTALL//\\/\\\\}"
_safe_dir="${_safe_dir//&/\\&}"
_safe_dir="${_safe_dir//|/\\|}"

echo "Packaging Outlook skills..."
echo "  Skills path:  $ABS_SKILLS"
echo "  Auth path:    $ABS_INSTALL"
echo ""

# ── Copy and rewrite skill files ──────────────────────────────────────────────
mkdir -p "$TMP/$_SKILLS_REL"

for dir in "$ROOT_DIR/.claude/skills"/outlook-*/; do
    name=$(basename "$dir")
    dest="$TMP/$_SKILLS_REL/$name"
    cp -r "$dir" "$dest/"
    # Rewrite proxy and auth paths to absolute installed locations
    find "$dest" -name "*.md" -exec sed -i \
        -e "s|python3 scripts/graph_call.py|python3 $_safe_dir/scripts/graph_call.py|g" \
        -e "s|bash outlook-skills/auth.sh|bash $_safe_dir/outlook-skills/auth.sh|g" {} \;
done

cp -r "$ROOT_DIR/.claude/skills/outlook-references" "$TMP/$_SKILLS_REL/outlook-references"

# ── Copy auth system and proxy ────────────────────────────────────────────────
mkdir -p "$TMP/$_INSTALL_REL/outlook-skills"
mkdir -p "$TMP/$_INSTALL_REL/scripts"

# Copy auth files (exclude venv, pycache, and compiled files)
rsync -a --exclude='.venv/' --exclude='__pycache__/' --exclude='*.pyc' \
    "$ROOT_DIR/outlook-skills/" "$TMP/$_INSTALL_REL/outlook-skills/" 2>/dev/null || \
cp -r "$ROOT_DIR/outlook-skills/." "$TMP/$_INSTALL_REL/outlook-skills/"
# Remove pycache if rsync wasn't available
rm -rf "$TMP/$_INSTALL_REL/outlook-skills/__pycache__" \
       "$TMP/$_INSTALL_REL/outlook-skills/.venv" 2>/dev/null || true

cp "$ROOT_DIR/scripts/graph_call.py" "$TMP/$_INSTALL_REL/scripts/graph_call.py"

# ── Create zip ────────────────────────────────────────────────────────────────
(cd "$TMP" && zip -qr "$OUTPUT" .)
rm -rf "$TMP"

echo "Created: $(basename "$OUTPUT")"
echo ""
echo "To install, run:"
echo "  unzip $(basename "$OUTPUT") -d ~/"
echo "  bash ~/.skills/outlook-mcp/outlook-skills/auth.sh"
echo ""
echo "Then in Claude Desktop or Claude Code, type:"
echo "  /outlook-email-list"
