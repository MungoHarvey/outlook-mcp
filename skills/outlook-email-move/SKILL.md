---
name: outlook-email-move
description: Move Outlook emails between folders. Use when user wants to move, file, or sort emails into folders.
---

# Move Emails

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Move Single Email

**SAFETY: Confirm before moving.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/move" '{"destinationId":"TARGET_FOLDER_ID"}'
```

Returns the moved message object: `{"status": 201, "data": {...}}` with its new ID in `.data.id`.

## Well-Known Folder IDs

Use these names directly as `destinationId`:
`inbox`, `drafts`, `sentitems`, `deleteditems`, `junkemail`, `archive`, `outbox`

For named folder resolution and batch move patterns, see [reference.md](reference.md).
