---
name: outlook-email-read
description: Read a specific Outlook email by ID, view full body and attachments. Use when user wants to read, open, view, or show an email message.
user_invocable: true
---

# Read Email

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Read Email by ID

```bash
python3 scripts/graph_call.py GET "/me/messages/{messageId}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,hasAttachments,importance,isRead,flag,categories"
```

The result is `{"status": 200, "data": {...}}`. The `.data.body.content` contains the full email body.

## List Attachments

```bash
python3 scripts/graph_call.py GET "/me/messages/{messageId}/attachments?$select=id,name,contentType,size"
```

Returns `{"status": 200, "data": {...}}`. The `.data.value[]` array contains attachments.

For body parsing template and attachment download, see [reference.md](reference.md).

For error handling, see [errors](../outlook-references/errors.yaml).
