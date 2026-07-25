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
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/messages/{messageId}" '{
    "flag": {
      "flagStatus": "flagged",
      "dueDateTime": {
        "dateTime": "2026-03-20T00:00:00",
        "timeZone": "UTC"
      }
    }
  }'
```

## Batch Update (Mark Multiple Read)

```bash
for MSG_ID in id1 id2 id3; do
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/messages/$MSG_ID" '{"isRead": true}'
done
```

Note: Respect throttling limits (max 4 concurrent). See [graph-api-patterns](references/graph-api-patterns.yaml).

## Set Importance

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"importance": "high"}'
```

Values: `low`, `normal`, `high`

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.
