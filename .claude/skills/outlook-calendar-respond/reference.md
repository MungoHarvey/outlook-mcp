# Calendar Respond — Reference

## Cancel vs Delete

| Action | Who | Notifies Attendees | Recoverable |
|---|---|---|---|
| **Cancel** (POST `.../cancel`) | Organizer only | Yes — sends cancellation | No (event marked cancelled) |
| **Delete** (DELETE `.../events/{id}`) | Anyone | No | No (silently removed) |

**Rules:**
- If the user is the **organizer** and there are attendees → use **cancel** (polite, sends notification)
- If the user is the **organizer** with no attendees → **delete** is fine
- If the user is an **attendee** → **decline** first, then optionally **delete** from their calendar

## Response Options

All response endpoints accept:

```json
{
  "comment": "Optional message to organizer/attendees",
  "sendResponse": true
}
```

- `comment` — optional text included in the response email
- `sendResponse` — set to `true` to notify the organizer (recommended), `false` to respond silently

## Propose New Time (Alternative)

```bash
python3 scripts/graph_call.py POST "/me/events/{eventId}/tentativelyAccept" '{
    "comment": "Can we do 3pm instead?",
    "proposedNewTime": {
      "start": {"dateTime": "2026-03-15T15:00:00", "timeZone": "UTC"},
      "end": {"dateTime": "2026-03-15T16:00:00", "timeZone": "UTC"}
    },
    "sendResponse": true
  }'
```

## Error Handling

See [errors](../outlook-references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 404 | Event not found (may have been deleted or cancelled) |
| 403 | Cannot cancel — user is not the organizer |
