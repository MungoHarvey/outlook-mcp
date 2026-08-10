---
name: outlook-calendar-update
description: Update existing Outlook calendar events — reschedule, change details, modify attendees. Use when user wants to reschedule, change, update, edit, or modify a meeting or event.
---

# Update Calendar Event

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Update Event (Partial)

Only include fields that need to change:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/events/{eventId}" '{"subject": "Updated Title"}'
```

**SAFETY: Confirm changes before updating, especially if event has attendees (they will be notified).**

Response: `.data` contains the updated event.

## Common Updates

Reschedule:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/events/{eventId}" '{"start": {"dateTime": "2026-03-16T14:00:00", "timeZone": "UTC"}, "end": {"dateTime": "2026-03-16T15:00:00", "timeZone": "UTC"}}'
```

Change location:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py PATCH "/me/events/{eventId}" '{"location": {"displayName": "New Room"}}'
```

For updatable fields reference and recurring event changes, see [reference.md](reference.md).

For parameter values (showAs, importance, etc.), see [calendar-create params](../outlook-calendar-create/params.yaml).

For timezone values, see [timezones](../outlook-base/references/timezones.yaml).
