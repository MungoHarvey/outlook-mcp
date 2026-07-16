---
name: outlook-email-organize
description: Change the state of specific Outlook emails — mark read/unread, apply or remove categories on a message, set or clear flags. Use when the user wants to mark an email read/unread, categorize/label an email, or flag/unflag an email.
user_invocable: true
---

# Organize Emails

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Mark as Read

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"isRead":true}'
```

## Mark as Unread

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"isRead":false}'
```

## Apply Categories

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"categories":["Category Name","Another Category"]}'
```

For available category colors, see [colors](../outlook-base/references/colors.yaml).

## Set Flag

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"flag":{"flagStatus":"flagged"}}'
```

Returns `{"status": 200, "data": {...}}` with the updated message properties.

For flag status values and batch patterns, see [reference.md](reference.md).
