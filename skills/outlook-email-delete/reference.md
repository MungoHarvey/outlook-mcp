# Email Delete — Reference

## Batch Soft Delete

Move multiple emails to Deleted Items:

```bash
for MSG_ID in id1 id2 id3; do
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/$MSG_ID/move" '{"destinationId": "deleteditems"}'
done
```

## Batch Permanent Delete

```bash
for MSG_ID in id1 id2 id3; do
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py DELETE "/me/messages/$MSG_ID"
done
```

Note: Respect throttling limits (max 4 concurrent). See [graph-api-patterns](references/graph-api-patterns.yaml).

## Soft vs Permanent Delete

| Method | Recoverable | Notifies | Use When |
|---|---|---|---|
| Move to deleteditems | Yes (until emptied) | No | Default — safe option |
| DELETE endpoint | No | No | Only when user explicitly wants permanent removal |

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 204 | Successfully deleted |
| 404 | Message not found (already deleted or moved) |
