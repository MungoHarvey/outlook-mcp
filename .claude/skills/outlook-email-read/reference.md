# Email Read — Reference

## Body Parsing Template

```bash
python3 -c "
import sys, json, html, re
data = json.load(sys.stdin)
sender = data.get('from', {}).get('emailAddress', {})
print(f\"From: {sender.get('name', '')} <{sender.get('address', '')}>\")
to_list = ', '.join(r['emailAddress']['address'] for r in data.get('toRecipients', []))
print(f\"To: {to_list}\")
cc_list = ', '.join(r['emailAddress']['address'] for r in data.get('ccRecipients', []))
if cc_list: print(f\"CC: {cc_list}\")
print(f\"Subject: {data.get('subject', '')}\")
print(f\"Date: {data.get('receivedDateTime', '')}\")
print(f\"Importance: {data.get('importance', 'normal')}\")
cats = data.get('categories', [])
if cats: print(f\"Categories: {', '.join(cats)}\")
flag = data.get('flag', {}).get('flagStatus', 'notFlagged')
if flag != 'notFlagged': print(f\"Flag: {flag}\")
print('---')
body = data.get('body', {})
if body.get('contentType') == 'html':
    text = re.sub('<[^>]+>', '', body.get('content', ''))
    print(html.unescape(text).strip())
else:
    print(body.get('content', ''))
"
```

## Download Attachment

```bash
# Get attachment content (base64-encoded for file attachments)
python3 scripts/graph_call.py GET "/me/messages/{messageId}/attachments/{attachmentId}"
```

The response includes `contentBytes` (base64) for file attachments. Decode with:
```bash
python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
content = base64.b64decode(data['contentBytes'])
with open(data['name'], 'wb') as f:
    f.write(content)
print(f\"Saved: {data['name']} ({len(content)} bytes)\")
"
```

## Attachment Pagination

If a message has many attachments, the response may include `@odata.nextLink`. Use that URL directly for the next page. See [graph-api-patterns](references/graph-api-patterns.yaml).

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 404 | Email may have been deleted or moved to another folder |
