# Contacts List — Reference

## Parsing Template

```bash
python3 -c "
import sys, json
data = json.load(sys.stdin).get('data') or {}
for i, c in enumerate(data.get('value', []), 1):
    name = f\"{c.get('givenName', '')} {c.get('surname', '')}\".strip() or '(no name)'
    emails = ', '.join(e.get('address', '') for e in c.get('emailAddresses', []))
    phone = c.get('mobilePhone', '') or (c.get('businessPhones', [None]) or [None])[0] or ''
    company = c.get('companyName', '')
    title = c.get('jobTitle', '')
    print(f\"{i}. {name}\")
    if emails: print(f\"   Email: {emails}\")
    if phone: print(f\"   Phone: {phone}\")
    if company: print(f\"   Company: {company}\")
    if title: print(f\"   Title: {title}\")
    print(f\"   ID: {c.get('id')}\")
    print()
next_link = data.get('@odata.nextLink')
if next_link:
    print(f'More results available. Next page: {next_link}')
"
```

## Folder-Specific Listing

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/contactFolders/{folderId}/contacts?\$top=10&\$select=id,givenName,surname,emailAddresses,mobilePhone,businessPhones"
```

## OData Filters

```bash
# By email address
&\$filter=emailAddresses/any(e:e/address%20eq%20'user@example.com')

# By name (starts with)
&\$filter=startswith(givenName,'John')

# By company
&\$filter=companyName%20eq%20'Acme%20Corp'
```

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.
