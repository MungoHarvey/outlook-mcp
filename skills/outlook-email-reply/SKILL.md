---
name: outlook-email-reply
description: Reply to, reply-all, or forward Outlook emails. Use when user wants to reply, reply all, forward, or respond to an email.
---

# Reply & Forward Emails

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Reply

**SAFETY: Always show reply summary and confirm before sending.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/reply" '{"comment":"Reply body text here"}'
```

## Reply All

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/replyAll" '{"comment":"Reply body text here"}'
```

## Forward

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/forward" '{"comment":"FYI — see below","toRecipients":[{"emailAddress":{"address":"recipient@example.com"}}]}'
```

All return HTTP 202 on success: `{"status": 202, "data": null}` (no body).

For adding attachments to replies and forwarding to multiple recipients, see [reference.md](reference.md).
