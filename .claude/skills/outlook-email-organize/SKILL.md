---
name: outlook-email-organize
description: Organize Outlook emails — mark read/unread, apply categories, set flags. Use when user wants to mark read, mark unread, categorize, label, flag, or unflag emails.
user_invocable: true
---

# Organize Emails

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Mark as Read

```bash
python3 scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"isRead":true}'
```

## Mark as Unread

```bash
python3 scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"isRead":false}'
```

## Apply Categories

```bash
python3 scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"categories":["Category Name","Another Category"]}'
```

For available category colors, see [colors](references/colors.yaml).

## Set Flag

```bash
python3 scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"flag":{"flagStatus":"flagged"}}'
```

Returns `{"status": 200, "data": {...}}` with the updated message properties.

For flag status values and batch patterns, see [reference.md](reference.md).
