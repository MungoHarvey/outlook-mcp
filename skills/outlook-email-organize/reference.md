# Email Organize — Reference

## Flag Status Values

```yaml
flagStatus:
  - notFlagged    # remove flag
  - flagged       # flag for follow-up
  - complete      # mark flag as complete
```

## Set Flag with Due Date

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "flag": {
      "flagStatus": "flagged",
      "dueDateTime": {
        "dateTime": "2026-03-20T00:00:00",
        "timeZone": "UTC"
      }
    }
  }' \
  "https://graph.microsoft.com/v1.0/me/messages/{messageId}"
```

## Batch Update (Mark Multiple Read)

```bash
for MSG_ID in id1 id2 id3; do
  curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"isRead": true}' \
    "https://graph.microsoft.com/v1.0/me/messages/$MSG_ID"
done
```

Note: Respect throttling limits (max 4 concurrent). See [graph-api-patterns](references/graph-api-patterns.yaml).

## Set Importance

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"importance": "high"}' \
  "https://graph.microsoft.com/v1.0/me/messages/{messageId}"
```

Values: `low`, `normal`, `high`

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.
