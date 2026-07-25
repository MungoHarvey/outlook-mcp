# Calendar Update — Reference

## Updatable Fields

All of these can be sent in a PATCH request (only include what changes):

```yaml
subject: "New title"
body: { contentType: "text", content: "New description" }
start: { dateTime: "...", timeZone: "..." }
end: { dateTime: "...", timeZone: "..." }
location: { displayName: "..." }
showAs: "busy"              # free, tentative, busy, outOfOffice, workingElsewhere
importance: "high"          # low, normal, high
sensitivity: "private"      # normal, personal, private, confidential
isReminderOn: true
reminderMinutesBeforeStart: 15
isAllDay: true
categories: ["Work"]
isOnlineMeeting: true
onlineMeetingProvider: "teamsForBusiness"
```

## Add/Remove Attendees

To update attendees, send the complete attendees array (not a delta):

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/events/{eventId}" '{
    "attendees": [
      {"emailAddress": {"address": "alice@example.com"}, "type": "required"},
      {"emailAddress": {"address": "charlie@example.com"}, "type": "optional"}
    ]
  }'
```

Note: This replaces the entire attendees list. Include all attendees you want to keep.

## Recurring Event Changes

### Update single occurrence
Use the occurrence ID (from calendarView), not the series master ID:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/events/{occurrenceId}" '{"subject": "Modified occurrence"}'
```

### Update entire series
Use the series master ID:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/events/{seriesMasterId}" '{"subject": "Updated Series Name"}'
```

### Change recurrence pattern
For major recurrence changes, it's often safer to cancel the series and create a new one.

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 409 | Event was modified by another client |
| 403 | Calendar is read-only or event is owned by another organizer |
