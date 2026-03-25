# Outlook Folders — Reference

## Parsing Template

```bash
python3 -c "
import sys, json
data = json.load(sys.stdin)
for f in data.get('value', []):
    name = f.get('displayName', '(unnamed)')
    total = f.get('totalItemCount', 0)
    unread = f.get('unreadItemCount', 0)
    children = f.get('childFolderCount', 0)
    unread_str = f' ({unread} unread)' if unread else ''
    child_str = f' [{children} subfolders]' if children else ''
    print(f\"  {name}: {total} items{unread_str}{child_str}\")
    print(f\"  ID: {f.get('id')}\")
"
```

## List Child Folders

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/mailFolders/{parentFolderId}/childFolders?$select=id,displayName,totalItemCount,unreadItemCount"
```

## Resolve Folder Name to ID

```bash
FOLDER_ID=$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/mailFolders?\$filter=displayName%20eq%20'FolderName'" | \
  python3 -c "import sys,json; v=json.load(sys.stdin).get('value',[]); print(v[0]['id'] if v else 'NOT_FOUND')")
```

## Batch Move Emails

```bash
for MSG_ID in id1 id2 id3; do
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/$MSG_ID/move" "{\"destinationId\": \"TARGET_FOLDER_ID\"}"
done
```

## Error Handling

| Code | Meaning | Action |
|---|---|---|
| 401 | Token expired | Refresh and retry |
| 404 | Folder or message not found | Check IDs |
| 409 | Conflict | Folder name already exists |
| 400 | Invalid folder name | Check characters |
