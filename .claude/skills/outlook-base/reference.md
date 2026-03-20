# Outlook Base — Reference

## graph_call.py Command Templates

### GET
```bash
python3 scripts/graph_call.py GET "/me/messages?$select=id,subject&$top=10"
```

### POST
```bash
python3 scripts/graph_call.py POST "/me/sendMail" '{"message":{"subject":"...","body":{"contentType":"HTML","content":"..."}}}'
```

### PATCH
```bash
python3 scripts/graph_call.py PATCH "/me/messages/{id}" '{"isRead":true}'
```

### DELETE
```bash
python3 scripts/graph_call.py DELETE "/me/messages/{id}"
```

### With Custom Headers (Timezone, Prefer)
```bash
python3 scripts/graph_call.py GET "/me/calendar/calendarView?startDateTime=2025-03-20T00:00:00&endDateTime=2025-03-21T00:00:00" --header "Prefer: outlook.timezone=\"America/New_York\""
```

## Error Handling

### HTTP Status Codes
| Code | Meaning | Action |
|---|---|---|
| 200-299 | Success | Parse JSON response |
| 401 | Token expired | Refresh token, retry once |
| 403 | Insufficient permissions | Re-authenticate with broader scopes |
| 404 | Resource not found | Report to user |
| 429 | Rate limited | Wait (`Retry-After` header), retry |
| 500-599 | Server error | Retry once after brief wait |

### Auto-Retry on 401
`python3 scripts/graph_call.py` handles 401 (Unauthorized) responses automatically:
- Detects expired tokens
- Refreshes the token silently
- Retries the request once
- No manual intervention needed from skills

## Response Parsing

`graph_call.py` returns responses in format: `{"status": N, "data": {...}}`

Always parse the `.data` field for the actual response body:

```bash
python3 scripts/graph_call.py GET "/me/messages?$top=5" | python3 -c "
import sys, json
response = json.load(sys.stdin)
data = response.get('data', {})
for item in data.get('value', []):
    print(item.get('id'), item.get('subject', ''))
"
```

For error responses, check the `status` field — non-2xx means an error occurred.

## OData Query Parameters

| Parameter | Purpose | Example |
|---|---|---|
| `$top=N` | Limit results | `$top=10` |
| `$select=fields` | Return specific fields | `$select=id,subject,from` |
| `$orderby=field` | Sort results | `$orderby=receivedDateTime desc` |
| `$filter=condition` | OData filter | `$filter=isRead eq false` |
| `$search="query"` | Full-text search (KQL) | `$search="from:alice"` |

URL-encode `$` as `\$` in bash, spaces as `%20`.

## Pagination

Always use `@odata.nextLink` for multi-page results. Never manually construct `$skip` or `$skipToken`.

```bash
# Check response for next page
next_link = data.get('@odata.nextLink')
if next_link:
    # Use this URL directly for the next page request
```

See [graph-api-patterns](../outlook-references/graph-api-patterns.yaml) for full pagination guidance.

## Throttling

- Max 4 concurrent requests to Outlook endpoints
- Respect `Retry-After` header on 429 responses
- Use exponential backoff: 2s, 4s, 8s, 16s
- Always use `$select` to reduce payload size

See [graph-api-patterns](../outlook-references/graph-api-patterns.yaml) for detailed throttling limits.

## Calendar Timezone Header

For calendar GET requests, use the `Prefer` header to get times in user's timezone:

```bash
-H "Prefer: outlook.timezone=\"America/New_York\""
```

See [timezones](../outlook-references/timezones.yaml) for IANA timezone values.

## OAuth Scopes

| Scope | Purpose |
|---|---|
| `offline_access` | Refresh tokens |
| `User.Read` | Read user profile |
| `Mail.Read` | Read email |
| `Mail.ReadWrite` | Modify email |
| `Mail.Send` | Send email |
| `Calendars.Read` | Read calendar |
| `Calendars.ReadWrite` | Modify calendar |
| `Contacts.Read` | Read contacts |

## Shared References

For detailed reference data, see the YAML files in [outlook-references](../outlook-references/):
- [timezones.yaml](../outlook-references/timezones.yaml) — IANA timezone values
- [colors.yaml](../outlook-references/colors.yaml) — Category color presets
- [errors.yaml](../outlook-references/errors.yaml) — HTTP error codes and actions
- [graph-api-patterns.yaml](../outlook-references/graph-api-patterns.yaml) — Pagination, throttling, batch, large attachments
