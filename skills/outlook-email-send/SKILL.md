---
name: outlook-email-send
description: "Compose and send Outlook emails immediately. Use when user wants to send an email, compose and send, write and send a message, email someone, fire off a quick email, or reply with a new message. If the user says 'draft' or 'don't send yet', use outlook-email-draft instead."
user_invocable: true
---

# Send Email

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Send Email

**SAFETY: Always show draft summary and confirm before sending.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/sendMail" '{"message":{"subject":"SUBJECT","body":{"contentType":"text","content":"BODY"},"toRecipients":[{"emailAddress":{"address":"to@example.com"}}]},"saveToSentItems":true}'
```

Returns HTTP 204 on success: `{"status": 204, "data": null}` (no body).

## Confirmation Template

Before sending, always present:
```
Draft Email:
  To: recipient@example.com
  CC: (none)
  BCC: (none)
  Subject: Your Subject Here
  Importance: normal
  Body preview: (first 200 chars...)

Send this email? [Confirm/Cancel]
```

## Parameter Options

See [params.yaml](params.yaml) for importance and content type values.

For CC/BCC, HTML content, and large attachment handling, see [reference.md](reference.md).
