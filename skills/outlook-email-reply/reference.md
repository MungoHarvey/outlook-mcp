# Email Reply — Reference

## Reply with HTML Comment

**SAFETY: Show the reply and confirm before sending.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/reply" - <<'JSON'
{"comment":"<p>Thanks for this — <b>great work</b>!</p>"}
JSON
```

The `comment` field supports HTML. The original message is automatically included in the reply thread.

## Forward to Multiple Recipients

**SAFETY: Confirm every recipient before forwarding.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/forward" - <<'JSON'
{
    "comment": "Sharing this with the team",
    "toRecipients": [
      {"emailAddress": {"address": "alice@example.com", "name": "Alice"}},
      {"emailAddress": {"address": "bob@example.com", "name": "Bob"}}
    ]
}
JSON
```

## Reply/Forward with Attachments

To add attachments to a reply or forward, use the two-step pattern:

1. **Create reply draft** (POST `.../createReply`, `.../createReplyAll`, or `.../createForward`)
2. **Add attachment** to the draft (POST `/me/messages/{draftId}/attachments`) — build the attachment JSON in a file as shown in [outlook-email-send reference](../outlook-email-send/reference.md#small-attachments-under-3mb)
3. **Send the draft** (POST `/me/messages/{draftId}/send`)

**SAFETY: Show the draft (recipients, comment, attachment names) and confirm before step 3.**

```bash
# Step 1: Create reply draft
DRAFT=$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/createReply" - <<'JSON'
{"comment":"See attached"}
JSON
)
DRAFT_ID=$(echo "$DRAFT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# Step 2: Add attachment (one fileAttachment object, built in a file)
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/$DRAFT_ID/attachments" @/tmp/outlook-attachment.json

# Step 3: Send — only after the user confirms
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/$DRAFT_ID/send"
```

## Error Handling

See [errors](../outlook-base/references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 202 | Reply/forward sent successfully |
| 404 | Original message not found (may have been deleted) |
