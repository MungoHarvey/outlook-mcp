---
name: outlook-email-draft
description: "Create and save Outlook email drafts without sending immediately. Use when user wants to draft an email, save a draft, prepare a message for later, compose without sending, create a draft with attachments, or when the user says 'don't send it yet' or 'save it for later'. Also use when building emails iteratively — drafts can be updated and sent when ready."
---

# Draft Email

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## When to Use Draft vs Send

Use this skill when the user wants to **prepare** an email without sending it immediately. The draft is saved to the Drafts folder and can be edited, reviewed, or sent later. Use `outlook-email-send` when the user wants to send right away.

## Create Draft

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages" '{"subject":"SUBJECT","body":{"contentType":"text","content":"BODY"},"toRecipients":[{"emailAddress":{"address":"to@example.com"}}]}'
```

Returns `{"status": 201, "data": {"id": "...", ...}}`. Save `.data.id` — this is the draft ID needed to update, send, or delete the draft later.

## Update a Draft

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/messages/{draftId}" '{"subject":"Updated Subject","body":{"contentType":"text","content":"Updated body"}}'
```

Any message field can be updated: subject, body, toRecipients, ccRecipients, bccRecipients, importance.

## Send a Draft

**SAFETY: Always confirm before sending.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{draftId}/send"
```

Returns HTTP 202 on success: `{"status": 202, "data": null}`.

## Present Draft Summary

After creating or updating a draft, show:
```
Draft saved (ID: AAMkAD...):
  To: recipient@example.com
  CC: (none)
  Subject: Your Subject Here
  Body preview: (first 200 chars...)

Draft is in your Drafts folder. Say "send it" when ready.
```

For CC/BCC, importance, HTML content, attachments, and listing/deleting drafts, see [reference.md](reference.md).

For parameter options, see [params.yaml](params.yaml).
