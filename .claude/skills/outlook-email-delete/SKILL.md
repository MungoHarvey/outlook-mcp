---
name: outlook-email-delete
description: Delete Outlook emails. Use when user wants to delete, trash, or remove an email message.
user_invocable: true
---

# Delete Emails

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Soft Delete (Move to Deleted Items)

**SAFETY: Always confirm before deleting.**

Preferred approach — moves to Deleted Items (recoverable):

```bash
python3 scripts/graph_call.py POST "/me/messages/{messageId}/move" '{"destinationId":"deleteditems"}'
```

## Permanent Delete

**SAFETY: This is irreversible. Double-confirm with user.**

```bash
python3 scripts/graph_call.py DELETE "/me/messages/{messageId}"
```

Returns HTTP 204 on success: `{"status": 204, "data": null}` (no body).

For batch delete pattern, see [reference.md](reference.md).
