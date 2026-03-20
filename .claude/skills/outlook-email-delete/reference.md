# Email Delete — Reference

## Batch Soft Delete

Move multiple emails to Deleted Items:

```bash
for MSG_ID in id1 id2 id3; do
  curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"destinationId": "deleteditems"}' \
    "https://graph.microsoft.com/v1.0/me/messages/$MSG_ID/move"
done
```

## Batch Permanent Delete

```bash
for MSG_ID in id1 id2 id3; do
  curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
    "https://graph.microsoft.com/v1.0/me/messages/$MSG_ID"
done
```

Note: Respect throttling limits (max 4 concurrent). See [graph-api-patterns](../outlook-references/graph-api-patterns.yaml).

## Soft vs Permanent Delete

| Method | Recoverable | Notifies | Use When |
|---|---|---|---|
| Move to deleteditems | Yes (until emptied) | No | Default — safe option |
| DELETE endpoint | No | No | Only when user explicitly wants permanent removal |

## Error Handling

See [errors](../outlook-references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 204 | Successfully deleted |
| 404 | Message not found (already deleted or moved) |
