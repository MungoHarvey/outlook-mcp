---
name: outlook-calendar-create
description: Create Outlook calendar events — single, recurring, all-day, Teams meetings, with attendees. Use when user wants to schedule, book, create a meeting, set up an event, or add to calendar.
user_invocable: true
---

# Create Calendar Event

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Basic Create

**SAFETY: Always show event summary and confirm before creating.**

```bash
python3 scripts/graph_call.py POST "/me/events" '{
  "subject": "Meeting Title",
  "start": {"dateTime": "2026-03-15T14:00:00", "timeZone": "UTC"},
  "end": {"dateTime": "2026-03-15T15:00:00", "timeZone": "UTC"},
  "body": {"contentType": "text", "content": "Description"}
}'
```

Response: `.data` contains the created event with its `id`.

## Timezone Handling

Always specify `timeZone` in start/end. Ask the user's timezone if not established.
See [timezones](references/timezones.yaml) for IANA timezone values.

## Parameter Options

See [params.yaml](params.yaml) for showAs, importance, sensitivity, attendee types, recurrence patterns, and online meeting providers.

## Advanced Options

For attendees, Teams meetings, all-day events, recurring events, and location, see [reference.md](reference.md).

For category colors, see [colors](references/colors.yaml).
