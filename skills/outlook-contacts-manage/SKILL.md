---
name: outlook-contacts-manage
description: Create and update Outlook contacts. Use when user wants to add, create, update, or edit a contact.
user_invocable: true
---

# Create & Update Contacts

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Create Contact

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/contacts" '{
  "givenName": "Jane",
  "surname": "Doe",
  "emailAddresses": [{"address": "jane@example.com", "name": "Jane Doe"}],
  "mobilePhone": "+1-555-0123",
  "companyName": "Acme Corp",
  "jobTitle": "Engineer"
}'
```

Response: `.data` contains the created contact with its `id`.

**Best practice**: Check for existing contact by email before creating to avoid duplicates. See [reference.md](reference.md).

## Update Contact

Only include fields to change:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/contacts/{contactId}" '{"jobTitle": "Senior Engineer", "companyName": "New Company"}'
```

Response: `.data` contains the updated contact.

Note: For structured fields (addresses), send the complete object even if only one sub-field changed.

## Parameter Options

See [params.yaml](params.yaml) for all available contact fields and types.

For full creation template and duplicate checking, see [reference.md](reference.md).
