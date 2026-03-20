---
name: outlook-base
description: Shared foundation for all Outlook skills — token management, curl patterns, error handling. Referenced by other skills, not invoked directly.
---

# Outlook Base — Shared Foundation

This skill contains shared patterns used by all Outlook skills. It is referenced by other skills and should not be invoked directly.

## Microsoft Graph API via graph_call.py

All API calls use the unified `python3 scripts/graph_call.py` proxy. No manual token handling is needed.

### Command Format

```bash
python3 scripts/graph_call.py METHOD "/endpoint" [body] [--header "Key: Value"]
```

**Parameters:**
- `METHOD`: GET, POST, PATCH, DELETE
- `"/endpoint"`: Graph API endpoint (e.g., `/me/messages?$top=10`)
- `body` (optional): JSON payload for POST/PATCH
- `--header` (optional): Custom headers (e.g., timezone, Prefer)

**Response format:** `{"status": N, "data": {...}}` — parse the `.data` field for the actual response.

### Examples

```bash
# GET list of emails
python3 scripts/graph_call.py GET "/me/messages?$select=id,subject&$top=10"

# POST to send email
python3 scripts/graph_call.py POST "/me/sendMail" '{"message":{"subject":"...","body":{...}}}'

# PATCH to mark email as read
python3 scripts/graph_call.py PATCH "/me/messages/{id}" '{"isRead":true}'

# DELETE email
python3 scripts/graph_call.py DELETE "/me/messages/{id}"
```

**Token Safety Rule**: Never attempt to read tokens directly, import the token helper module, or call the token acquisition function. Always use `python3 scripts/graph_call.py` for all Microsoft Graph API calls.

## Safety Rules

1. **Never display raw tokens** to the user
2. **Always confirm before destructive actions**: sending email, deleting events, creating rules
3. **Sanitize user input** in JSON strings
4. **Use `-s` flag** on all curl calls
