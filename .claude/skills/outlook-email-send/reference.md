# Email Send — Reference

## Send with CC, BCC, and Importance

```bash
python3 scripts/graph_call.py POST "/me/sendMail" '{
    "message": {
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
    },
    "saveToSentItems": true
  }'
```

## Small Attachments (under 3MB)

Inline base64 in the message JSON:

```bash
python3 scripts/graph_call.py POST "/me/sendMail" '{
    "message": {
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
    },
    "saveToSentItems": true
  }'
```

## Large Attachments (3MB–150MB)

Use an upload session. See [graph-api-patterns](references/graph-api-patterns.yaml) for the upload session pattern.

1. First create a draft message (POST `/me/messages`)
2. Create upload session on the draft
3. Upload file in chunks via PUT
4. Send the draft (POST `/me/messages/{draftId}/send`)

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 202 | Email sent successfully (no response body) |
| 400 | Invalid recipient address or malformed JSON |
| 413 | Attachment too large for inline (use upload session) |
