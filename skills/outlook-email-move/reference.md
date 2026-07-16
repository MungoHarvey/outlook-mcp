# Email Move — Reference

## Resolve Folder Name to ID

```bash
FOLDER_ID=$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/mailFolders?\$filter=displayName%20eq%20'FolderName'" | \
  python3 -c "import sys,json; v=json.load(sys.stdin).get('data',{}).get('value',[]); print(v[0]['id'] if v else 'NOT_FOUND')")
```

## Batch Move Multiple Emails

```bash
for MSG_ID in id1 id2 id3; do
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/$MSG_ID/move" "{\"destinationId\": \"$FOLDER_ID\"}"
done
```

Note: Respect throttling limits (max 4 concurrent Outlook requests). See [graph-api-patterns](references/graph-api-patterns.yaml).

## Copy Email (Non-Destructive)

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/copy" '{"destinationId": "TARGET_FOLDER_ID"}'
```

## Limitations

- Move/copy only works within the same mailbox
- Cannot move to shared mailboxes
- The message gets a new ID after moving

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 404 | Message or destination folder not found |
| 400 | Invalid destination folder ID |
