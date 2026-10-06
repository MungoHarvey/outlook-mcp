# Email Delete — Reference

## Batch Soft Delete

Move multiple emails to Deleted Items:

```bash
for MSG_ID in id1 id2 id3; do
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/$MSG_ID/move" '{"destinationId": "deleteditems"}'
done
```

## Batch Hard Delete

**SAFETY: Confirm the full list with the user first.**

```bash
for MSG_ID in id1 id2 id3; do
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py DELETE "/me/messages/$MSG_ID"
done
```

Note: Respect throttling limits (max 4 concurrent). See [graph-api-patterns](../outlook-base/references/graph-api-patterns.yaml).

## Soft vs Hard vs Permanent Delete

| Method | Where it goes | User can recover? | Use When |
|---|---|---|---|
| `POST …/move` to `deleteditems` | Deleted Items | Yes, until emptied | Default — safe option |
| `DELETE /me/messages/{id}` | Recoverable Items | Usually, via "Recover deleted items" within the retention period | User wants it gone from Deleted Items too |
| `POST …/permanentDelete` | Purges (hidden) | No | Only on an explicit, double-confirmed request to purge |

Source: Microsoft Graph v1.0 docs for `message: permanentDelete` and `Delete message` (the latter notes deleted items land in Recoverable Items). Retention periods are set by the mailbox administrator.

## Error Handling

See [errors](../outlook-base/references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 204 | Successfully deleted |
| 404 | Message not found (already deleted or moved) |
