---
name: outlook-email-delete
description: Delete Outlook emails. Use when user wants to delete, trash, or remove an email message.
---

# Delete Emails

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Soft Delete (Move to Deleted Items)

**SAFETY: Always confirm before deleting.**

Preferred approach — moves to Deleted Items (recoverable):

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/move" '{"destinationId":"deleteditems"}'
```

## Hard Delete (Skip Deleted Items)

**SAFETY: Confirm with user.** Removes the message from all folders, including Deleted Items. It goes to the mailbox's Recoverable Items area, so it can usually still be restored with Outlook's "Recover deleted items" during the retention period.

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py DELETE "/me/messages/{messageId}"
```

Returns HTTP 204 on success: `{"status": 204, "data": null}` (no body).

## Permanent Delete (Purge)

**SAFETY: Irreversible for the user. Double-confirm — name the message (sender, subject, date) and ask the user to confirm a second time.** Only when the user explicitly asks for the message to be purged or unrecoverable.

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/permanentDelete"
```

Moves the message to the hidden Purges folder, which Outlook clients cannot access; it is then removed after the retention period (unless the mailbox is on hold). Returns HTTP 204.

For batch delete pattern, see [reference.md](reference.md).
