# Email Draft — Reference

## Create Draft with CC, BCC, and Importance

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages" - <<'JSON'
{
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
}
JSON
```

## Draft with Attachments (under 3MB)

Build the body in a file and pass it with `@FILE` — never paste base64 into the command. Use the script in [outlook-email-send reference](../outlook-email-send/reference.md#small-attachments-under-3mb), dropping the outer `"message"` wrapper and `saveToSentItems`, then:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages" @/tmp/outlook-body.json
```

Or add a file to an existing draft:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{draftId}/attachments" @/tmp/outlook-attachment.json
```

where the file holds one `{"@odata.type":"#microsoft.graph.fileAttachment","name":…,"contentBytes":…}` object.

## Large Attachments (3MB–150MB)

**Not yet supported** — see [outlook-email-send reference](../outlook-email-send/reference.md#large-attachments-3mb150mb).

## List Drafts

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/mailFolders/drafts/messages?\$select=id,subject,toRecipients,createdDateTime,bodyPreview&\$top=10&\$orderby=createdDateTime%20desc"
```

## Delete a Draft

**SAFETY: Confirm before deleting** — show the draft's subject and recipients. The draft is removed from Drafts (it goes to Recoverable Items, not Deleted Items).

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py DELETE "/me/messages/{draftId}"
```

Returns HTTP 204 on success.

## Error Handling

See [errors](../outlook-base/references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 201 | Draft created successfully |
| 202 | Draft sent successfully |
| 400 | Invalid recipient address or malformed JSON |
| 404 | Draft not found (may have been sent or deleted) |
