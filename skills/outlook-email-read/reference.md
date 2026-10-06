# Email Read — Reference

## Body Parsing Template

```bash
python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', {})
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
# graph_call.py has already sanitised the body to plain text and wrapped it in
# [BEGIN UNTRUSTED CONTENT] … [END UNTRUSTED CONTENT] markers.
print(body.get('content', ''))
"
```

## Why Bodies Are Sanitised

Email HTML can hide text from the human reader that a model would still read — `display:none`, zero-size or same-colour text, off-screen positioning, HTML comments, and invisible Unicode (zero-width, bidi overrides, "tag" characters). `graph_call.py` runs every response through `scripts/sanitize.py` (a real HTML parser, not regex) **before** printing it, so the raw HTML never enters the conversation. `--raw-body` disables this and must not be used for received mail.

## Attachment Types

| `@odata.type` | What it is | How to get it |
|---|---|---|
| `#microsoft.graph.fileAttachment` | An ordinary file | `GET …/attachments/{id}/$value --out-dir DIR` |
| `#microsoft.graph.itemAttachment` | An attached email, event or contact | `GET …/attachments/{id}/$value --out-dir DIR` saves it as `.eml` (MIME); or `GET …/attachments/{id}?$expand=microsoft.graph.itemattachment/item` to read it (sanitised) |
| `#microsoft.graph.referenceAttachment` | A link to a cloud file (OneDrive/SharePoint) | Not downloadable here — show the user the name only |

Without `--out-dir`, binary responses are never printed (you get the size and content type only), and large `contentBytes` values are replaced by a placeholder, so attachments cannot flood the conversation.

## Attachment Pagination

If a message has many attachments, the response may include `@odata.nextLink`. Pass that URL back unchanged, in single quotes, for the next page. See [graph-api-patterns](../outlook-base/references/graph-api-patterns.yaml).

## Error Handling

See [errors](../outlook-base/references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 404 | Email may have been deleted or moved to another folder |
