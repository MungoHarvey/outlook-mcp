---
name: outlook-email-list
description: List and search Outlook emails. Use when user mentions inbox, emails, unread messages, check mail, search email, find email.
---

# List & Search Emails

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## List Recent Emails

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/messages?\$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments,importance,isRead&\$top=10&\$orderby=receivedDateTime%20desc"
```

The result is `{"status": 200, "data": {...}}`. The `.data.value[]` array contains the messages.

Always use `$select` for performance. See [graph-api-patterns](../outlook-base/references/graph-api-patterns.yaml) for recommended fields.

## Search Emails (KQL)

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/messages?\$search=\"SEARCH_TERM\"&\$select=id,subject,from,receivedDateTime,bodyPreview,isRead&\$top=10"
```

Field-specific: `$search="from:user@example.com"` or `$search="subject:report"`

## Pagination

If the response contains `@odata.nextLink`, use that URL directly for the next page. Never manually construct `$skip`. See [graph-api-patterns](../outlook-base/references/graph-api-patterns.yaml).

For folder-specific listing, OData filters, and response parsing templates, see [reference.md](reference.md).
