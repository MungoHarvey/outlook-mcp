---
name: outlook-calendar-respond
description: Respond to Outlook calendar invitations — accept, decline, tentatively accept, or cancel events. Use when user wants to accept, decline, RSVP, cancel a meeting, or respond to an invitation.
---

# Respond to Calendar Events

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Accept

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/events/{eventId}/accept" '{"comment": "Looking forward to it!", "sendResponse": true}'
```

## Decline

**SAFETY: Confirm before declining** — with `sendResponse: true` the organiser is emailed.

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/events/{eventId}/decline" '{"comment": "Sorry, I have a conflict", "sendResponse": true}'
```

## Tentatively Accept

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/events/{eventId}/tentativelyAccept" '{"comment": "Might be able to attend", "sendResponse": true}'
```

## Cancel Event (Organizer Only)

**SAFETY: Confirm — this notifies all attendees that the meeting is cancelled.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/events/{eventId}/cancel" '{"comment": "Meeting cancelled — will reschedule"}'
```

## Delete Event

**SAFETY: Confirm before deleting.** If the user is the **organiser** of a meeting with attendees, deleting it **sends every attendee a cancellation** — prefer `cancel` above so a message can be included. The event goes to Deleted Items.

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py DELETE "/me/events/{eventId}"
```

Returns 204. Accept, decline, tentative and cancel return 202 on success: `{"status": 202, "data": null}`.

For cancel vs delete guidance and response options, see [reference.md](reference.md).
