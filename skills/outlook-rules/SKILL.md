---
name: outlook-rules
description: Manage Outlook inbox rules — list, create, modify priority. Use when user mentions inbox rules, email automation, auto-sorting, email filters.
user_invocable: true
---

# Outlook Inbox Rules

Manage inbox rules through Microsoft Graph API.

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## List Rules

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/mailFolders/inbox/messageRules"
```

For parsing template, see [reference.md](reference.md).

## Create Rule

**SAFETY: Always show rule summary and confirm before creating.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/mailFolders/inbox/messageRules" '{"displayName":"RuleName","sequence":1,"isEnabled":true,"conditions":{},"actions":{}}'
```

For conditions, actions, and more templates, see [templates.md](templates.md).

## Edit Rule Priority

Lower sequence = higher priority (runs first):

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/mailFolders/inbox/messageRules/{ruleId}" '{"sequence":2}'
```
