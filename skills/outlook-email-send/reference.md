# Email Send — Reference

## Send with CC, BCC, and Importance

**SAFETY: Show the summary (all recipients including BCC) and confirm before sending.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/sendMail" - <<'JSON'
{
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
}
JSON
```

## Small Attachments (under 3MB)

**SAFETY: Show the summary, including attachment names, and confirm before sending.**

Never paste base64 into the command — build the request body in a file and pass it with `@FILE`. This keeps the file contents out of the conversation and has no command-line size limit:

```bash
python3 - "path/to/filename.pdf" > /tmp/outlook-body.json <<'PY'
import base64, json, mimetypes, os, sys
path = sys.argv[1]
print(json.dumps({
  "message": {
    "subject": "SUBJECT",
    "body": {"contentType": "text", "content": "See attached."},
    "toRecipients": [{"emailAddress": {"address": "to@example.com"}}],
    "attachments": [{
      "@odata.type": "#microsoft.graph.fileAttachment",
      "name": os.path.basename(path),
      "contentType": mimetypes.guess_type(path)[0] or "application/octet-stream",
      "contentBytes": base64.b64encode(open(path, "rb").read()).decode()
    }]
  },
  "saveToSentItems": True
}))
PY
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/sendMail" @/tmp/outlook-body.json
rm -f /tmp/outlook-body.json
```

## Large Attachments (3MB–150MB)

**Not yet supported.** Graph requires an upload session whose chunks are PUT to a separate pre-authenticated `uploadUrl`; `graph_call.py` deliberately only talks to Microsoft Graph, so it cannot do that step. Tell the user the file is too large to attach here and suggest sharing a link instead.

## Error Handling

See [errors](../outlook-base/references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 202 | Email sent successfully (no response body) |
| 400 | Invalid recipient address or malformed JSON |
| 413 | Attachment too large to send inline (over ~3MB) — not supported here |
