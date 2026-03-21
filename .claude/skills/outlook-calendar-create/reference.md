# Calendar Create — Reference

## Event with Attendees

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "subject": "Team Standup",
    "start": {"dateTime": "2026-03-15T09:00:00", "timeZone": "Europe/London"},
    "end": {"dateTime": "2026-03-15T09:30:00", "timeZone": "Europe/London"},
    "location": {"displayName": "Conference Room A"},
    "attendees": [
      {"emailAddress": {"address": "alice@example.com", "name": "Alice"}, "type": "required"},
      {"emailAddress": {"address": "bob@example.com", "name": "Bob"}, "type": "optional"}
    ],
    "showAs": "busy",
    "importance": "normal",
    "isReminderOn": true,
    "reminderMinutesBeforeStart": 15,
    "responseRequested": true
  }' \
  "https://graph.microsoft.com/v1.0/me/events"
```

## Teams Meeting

Add these fields to enable Teams:
```json
{
  "isOnlineMeeting": true,
  "onlineMeetingProvider": "teamsForBusiness"
}
```

The response will include `onlineMeeting.joinUrl` for the Teams link.

## All-Day Event

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "subject": "Holiday",
    "isAllDay": true,
    "start": {"dateTime": "2026-03-20T00:00:00", "timeZone": "UTC"},
    "end": {"dateTime": "2026-03-21T00:00:00", "timeZone": "UTC"},
    "showAs": "outOfOffice"
  }' \
  "https://graph.microsoft.com/v1.0/me/events"
```

Note: End date is exclusive — a 1-day event needs end = start + 1 day.

## Recurring Event

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "subject": "Weekly Sync",
    "start": {"dateTime": "2026-03-16T10:00:00", "timeZone": "UTC"},
    "end": {"dateTime": "2026-03-16T10:30:00", "timeZone": "UTC"},
    "recurrence": {
      "pattern": {
        "type": "weekly",
        "interval": 1,
        "daysOfWeek": ["monday"]
      },
      "range": {
        "type": "endDate",
        "startDate": "2026-03-16",
        "endDate": "2026-06-16"
      }
    }
  }' \
  "https://graph.microsoft.com/v1.0/me/events"
```

## Location Options

```json
{"location": {"displayName": "Room name or address"}}
```

For rooms with email:
```json
{"location": {"displayName": "Board Room", "locationEmailAddress": "boardroom@example.com"}}
```

## Confirmation Template

Before creating, always present:
```
New Event:
  Subject: Meeting Title
  Start: 2026-03-15 14:00 (America/New_York)
  End: 2026-03-15 15:00
  Location: (none)
  Attendees: alice@example.com (required), bob@example.com (optional)
  Teams meeting: Yes/No
  Show as: busy
  Recurrence: (none)

Create this event? [Confirm/Cancel]
```

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 403 | Calendar may be read-only |
| 409 | Conflict with existing event (rare) |
