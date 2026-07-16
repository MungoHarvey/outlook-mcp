# Outlook Rules — Reference

## Parsing Template

```bash
python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', {})
for i, rule in enumerate(data.get('value', []), 1):
    enabled = 'ON' if rule.get('isEnabled') else 'OFF'
    seq = rule.get('sequence', '?')
    print(f\"{i}. [{enabled}] (priority: {seq}) {rule.get('displayName', '(unnamed)')}\")
    conds = rule.get('conditions', {})
    if conds.get('senderContains'):
        print(f\"   IF sender contains: {', '.join(conds['senderContains'])}\")
    if conds.get('subjectContains'):
        print(f\"   IF subject contains: {', '.join(conds['subjectContains'])}\")
    if conds.get('fromAddresses'):
        addrs = ', '.join(a.get('emailAddress', {}).get('address', '') for a in conds['fromAddresses'])
        print(f\"   IF from: {addrs}\")
    if conds.get('hasAttachments'):
        print(f\"   IF has attachments\")
    actions = rule.get('actions', {})
    if actions.get('moveToFolder'):
        print(f\"   THEN move to folder: {actions['moveToFolder']}\")
    if actions.get('markAsRead'):
        print(f\"   THEN mark as read\")
    if actions.get('delete'):
        print(f\"   THEN delete\")
    if actions.get('forwardTo'):
        fwd = ', '.join(a.get('emailAddress', {}).get('address', '') for a in actions['forwardTo'])
        print(f\"   THEN forward to: {fwd}\")
    if actions.get('stopProcessingRules'):
        print(f\"   THEN stop processing more rules\")
    print(f\"   ID: {rule.get('id')}\")
    print()
"
```

## API Limitations

The inbox rules API supports only a subset of the full Outlook desktop client rules:
- **Flag action** is not available in v1.0
- Some rules created in the desktop client may appear **read-only** via the API
- Cannot filter messages by which rule was applied to them
- Max 4 concurrent mailbox operations (throttling)

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Meaning | Action |
|---|---|---|
| 401 | Token expired | Refresh and retry |
| 404 | Rule not found | Check ID |
| 400 | Invalid conditions/actions | Check field format |
| 409 | Name conflict | Rule name already exists |
