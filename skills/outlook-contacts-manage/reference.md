# Contacts Manage — Reference

## Duplicate Check Before Creating

```bash
EXISTING=$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/contacts?\$filter=emailAddresses/any(e:e/address%20eq%20'jane@example.com')&\$select=id,givenName,surname" | \
  python3 -c "import sys,json; v=(json.load(sys.stdin).get('data') or {}).get('value',[]); print(v[0]['id'] if v else 'NONE')")

if [ "$EXISTING" != "NONE" ]; then
    echo "Contact already exists with ID: $EXISTING"
fi
```

## Full Contact Creation

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/contacts" '{
    "givenName": "Jane",
    "surname": "Doe",
    "emailAddresses": [
      {"address": "jane.doe@example.com", "name": "Jane Doe"}
    ],
    "mobilePhone": "+1-555-0123",
    "businessPhones": ["+1-555-0124"],
    "homePhones": ["+1-555-0125"],
    "companyName": "Acme Corp",
    "jobTitle": "Engineer",
    "department": "Engineering",
    "officeLocation": "Building A, Floor 3",
    "businessAddress": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94105",
      "countryOrRegion": "US"
    },
    "homeAddress": {
      "street": "456 Oak Ave",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94110",
      "countryOrRegion": "US"
    },
    "birthday": "1990-06-15",
    "personalNotes": "Met at conference 2025"
  }'
```

## Create in Specific Folder

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/contactFolders/{folderId}/contacts" '{"givenName": "Jane", "surname": "Doe", "emailAddresses": [{"address": "jane@example.com"}]}'
```

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 400 | Invalid field format (check email addresses, phone format) |
| 404 | Contact not found (for updates) |
