# Email Reply — Reference

## Reply with HTML Comment

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/reply" '{"comment":"<p>Thanks for this — <b>great work</b>!</p>"}'
```

The `comment` field supports HTML. The original message is automatically included in the reply thread.

## Forward to Multiple Recipients

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/forward" '{
    "comment": "Sharing this with the team",
    "toRecipients": [
      {"emailAddress": {"address": "alice@example.com", "name": "Alice"}},
      {"emailAddress": {"address": "bob@example.com", "name": "Bob"}}
    ]
  }'
```

## Reply/Forward with Attachments

To add attachments to a reply or forward, use the two-step pattern:

1. **Create reply draft** (POST `.../createReply`, `.../createReplyAll`, or `.../createForward`)
2. **Add attachment** to the draft (POST `/me/messages/{draftId}/attachments`)
3. **Send the draft** (POST `/me/messages/{draftId}/send`)

```bash
# Step 1: Create reply draft
DRAFT=$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/createReply" '{"comment":"See attached"}')
DRAFT_ID=$(echo "$DRAFT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# Step 2: Add attachment
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/$DRAFT_ID/attachments" '{
    "@odata.type": "#microsoft.graph.fileAttachment",
    "name": "file.pdf",
    "contentType": "application/pdf",
    "contentBytes": "BASE64_CONTENT"
  }'

# Step 3: Send
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/$DRAFT_ID/send" '{}'
```

## Error Handling

See [errors](../outlook-base/references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 202 | Reply/forward sent successfully |
| 404 | Original message not found (may have been deleted) |
