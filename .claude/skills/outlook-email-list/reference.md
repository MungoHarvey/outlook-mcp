# Email List — Reference

## Folder-Specific Listing

### Well-known folder names (use directly as folder ID)
`inbox`, `drafts`, `sentitems`, `deleteditems`, `junkemail`, `archive`, `outbox`

```bash
python3 scripts/graph_call.py GET "/me/mailFolders/sentitems/messages?$top=10&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead"
```

### Named folder resolution
```bash
FOLDER_ID=$(python3 scripts/graph_call.py GET "/me/mailFolders?\$filter=displayName%20eq%20'FolderName'" | \
  python3 -c "import sys,json; v=json.load(sys.stdin).get('value',[]); print(v[0]['id'] if v else 'NOT_FOUND')")

python3 scripts/graph_call.py GET "/me/mailFolders/$FOLDER_ID/messages?$top=10&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead"
```

## OData Filters

```bash
# Unread only
&\$filter=isRead%20eq%20false

# With attachments
&\$filter=hasAttachments%20eq%20true

# From specific sender
&\$filter=from/emailAddress/address%20eq%20'user@example.com'

# Combined (AND)
&\$filter=isRead%20eq%20false%20and%20hasAttachments%20eq%20true

# Date range
&\$filter=receivedDateTime%20ge%202026-03-01T00:00:00Z
```

## Parsing Template

```bash
python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, msg in enumerate(data.get('value', []), 1):
    sender = msg.get('from', {}).get('emailAddress', {})
    read = '' if msg.get('isRead') else '[UNREAD] '
    att = ' [ATT]' if msg.get('hasAttachments') else ''
    print(f\"{i}. {read}{msg.get('receivedDateTime', '')[:16]}{att}\")
    print(f\"   From: {sender.get('name', 'Unknown')} <{sender.get('address', '')}>\")
    print(f\"   Subject: {msg.get('subject', '(no subject)')}\")
    print(f\"   Preview: {msg.get('bodyPreview', '')[:100]}\")
    print(f\"   ID: {msg.get('id')}\")
    print()
next_link = data.get('@odata.nextLink')
if next_link:
    print(f'More results available. Next page: {next_link}')
"
```

## Error Handling

See [errors](../outlook-references/errors.yaml) for common HTTP error codes.
