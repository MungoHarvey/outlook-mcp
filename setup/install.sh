#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/.skills/outlook-mcp}"
SKILLS_DIR="${SKILLS_DIR:-$HOME/.claude/skills}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Create directories
mkdir -p "$INSTALL_DIR/scripts" "$INSTALL_DIR/outlook-skills" "$SKILLS_DIR"

# 2. Install Python auth system
cp -r "$ROOT_DIR/outlook-skills/." "$INSTALL_DIR/outlook-skills/"

# 3. Install graph_call.py proxy
cp "$ROOT_DIR/scripts/graph_call.py" "$INSTALL_DIR/scripts/graph_call.py"

# 4. Install skill folders (outlook-* + outlook-references)
# Sanitize INSTALL_DIR for use in sed replacement strings (escape \, &, and | metacharacters)
_safe_dir="${INSTALL_DIR//\\/\\\\}"
_safe_dir="${_safe_dir//&/\\&}"
_safe_dir="${_safe_dir//|/\\|}"

for dir in "$ROOT_DIR/.claude/skills"/outlook-*/; do
  name=$(basename "$dir")
  dest="$SKILLS_DIR/$name"
  cp -r "$dir" "$dest/"
  # Rewrite relative paths in all .md files
  find "$dest" -name "*.md" -exec sed -i \
    -e "s|python3 scripts/graph_call.py|python3 $_safe_dir/scripts/graph_call.py|g" \
    -e "s|bash outlook-skills/auth.sh|bash $_safe_dir/outlook-skills/auth.sh|g" {} \;
done
cp -r "$ROOT_DIR/.claude/skills/outlook-references" "$SKILLS_DIR/outlook-references"

# 5. Bootstrap venv
bash "$INSTALL_DIR/outlook-skills/auth.sh" --status || true

echo "✓ Outlook skills installed"
echo "  Skills:   $SKILLS_DIR/outlook-*"
echo "  Auth:     $INSTALL_DIR/outlook-skills/"
echo "  Proxy:    $INSTALL_DIR/scripts/graph_call.py"
echo ""
echo "Next step: bash $INSTALL_DIR/outlook-skills/auth.sh"
