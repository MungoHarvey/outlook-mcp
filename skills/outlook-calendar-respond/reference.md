# Calendar Respond — Reference

## Cancel vs Delete

| Action | Who | Notifies Attendees | Where it goes |
|---|---|---|---|
| **Cancel** (POST `.../cancel`) | Organiser only | Yes — cancellation with your comment | Removed from calendar |
| **Delete** (DELETE `.../events/{id}`) as organiser of a meeting | Organiser | **Yes — Graph sends a cancellation** (no custom comment) | Deleted Items |
| **Delete** as attendee, or an event with no attendees | Anyone | No | Deleted Items |

Source: Microsoft Graph v1.0 "Delete event" — "deleting the event on the organizer's calendar sends a cancellation message to the meeting attendees."

**Rules:**
- User is the **organiser** and there are attendees → use **cancel** (lets you include a message). Never delete "quietly" — attendees are notified either way.
- User is the **organiser** with no attendees → **delete** is fine
- User is an **attendee** → **decline** first (so the organiser knows), then optionally **delete** from their calendar

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
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/events/{eventId}/tentativelyAccept" '{
    "comment": "Can we do 3pm instead?",
    "proposedNewTime": {
      "start": {"dateTime": "2026-03-15T15:00:00", "timeZone": "UTC"},
      "end": {"dateTime": "2026-03-15T16:00:00", "timeZone": "UTC"}
    },
    "sendResponse": true
  }'
```

## Error Handling

See [errors](../outlook-base/references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 404 | Event not found (may have been deleted or cancelled) |
| 403 | Cannot cancel — user is not the organizer |
