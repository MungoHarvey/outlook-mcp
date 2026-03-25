# Email Draft — Reference

## Create Draft with CC, BCC, and Importance

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages" '{
    "subject": "SUBJECT",
    "body": {
      "contentType": "html",
      "content": "<p>HTML body content</p>"
    },
    "toRecipients": [
      {"emailAddress": {"address": "to@example.com"}}
    ],
    "ccRecipients": [
      {"emailAddress": {"address": "cc@example.com"}}
    ],
    "bccRecipients": [
      {"emailAddress": {"address": "bcc@example.com"}}
    ],
    "importance": "high"
  }'
```

## Draft with Attachments (under 3MB)

Inline base64 in the message JSON:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages" '{
    "subject": "SUBJECT",
    "body": {"contentType": "text", "content": "See attached."},
    "toRecipients": [{"emailAddress": {"address": "to@example.com"}}],
    "attachments": [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        "name": "filename.pdf",
        "contentType": "application/pdf",
        "contentBytes": "BASE64_ENCODED_CONTENT"
      }
    ]
  }'
```

## Large Attachments (3MB–150MB)

Use an upload session on the draft. See [graph-api-patterns](references/graph-api-patterns.yaml).

1. Create draft (POST `/me/messages`)
2. Create upload session on the draft attachment
3. Upload file in chunks via PUT
4. Send when ready (POST `/me/messages/{draftId}/send`)

## List Drafts

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/mailFolders/drafts/messages?$select=id,subject,toRecipients,createdDateTime,bodyPreview&$top=10&$orderby=createdDateTime desc"
```

## Delete a Draft

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py DELETE "/me/messages/{draftId}"
```

Returns HTTP 204 on success.

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 201 | Draft created successfully |
| 202 | Draft sent successfully |
| 400 | Invalid recipient address or malformed JSON |
| 404 | Draft not found (may have been sent or deleted) |
