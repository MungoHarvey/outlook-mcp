---
name: outlook-contacts-list
description: List and search Outlook contacts. Use when user mentions contacts, address book, find contact, phone number, look up someone's email.
user_invocable: true
---

# List & Search Contacts

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## List Contacts

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/contacts?\$top=10&\$select=id,givenName,surname,emailAddresses,mobilePhone,businessPhones,companyName,jobTitle&\$orderby=givenName"
```

Response: `.data.value[]` contains the contacts array.

## Search Contacts

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/contacts?\$search=%22SEARCH_TERM%22&\$select=id,givenName,surname,emailAddresses,mobilePhone,businessPhones,companyName"
```

Response: `.data.value[]` contains the search results.

## Get Contact Details

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/contacts/{contactId}"
```

Response: `.data` contains the contact object.

For parsing template, folder-specific listing, and OData filters, see [reference.md](reference.md).
