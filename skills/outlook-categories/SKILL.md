---
name: outlook-categories
description: List the available Outlook category definitions and their colors (read-only). Use when the user asks what categories or color tags exist. To apply a category to an email, use outlook-email-organize.
---

# Outlook Categories

List available categories through Microsoft Graph API.

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## List Categories

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/outlook/masterCategories"
```

Parse:
```bash
python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', {})
response = json.loads(data) if isinstance(data, str) else data
for cat in response.get('value', []):
    print(f\"  {cat.get('displayName', '(unnamed)')} — color: {cat.get('color', 'none')}\")
"
```

## Using Categories

Categories returned here can be applied to:
- **Calendar events**: `"categories": ["Category Name"]` in create/update
- **Email messages**: update a message with `"categories": ["Category Name"]`

For color preset mapping, see [colors](../outlook-base/references/colors.yaml).

For applying categories to specific items, use the [outlook-email-organize](../outlook-email-organize/SKILL.md) or [outlook-calendar-update](../outlook-calendar-update/SKILL.md) skills.
