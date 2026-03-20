---
name: outlook-calendar-respond
description: Respond to Outlook calendar invitations — accept, decline, tentatively accept, or cancel events. Use when user wants to accept, decline, RSVP, cancel a meeting, or respond to an invitation.
user_invocable: true
---

# Respond to Calendar Events

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Accept

```bash
python3 scripts/graph_call.py POST "/me/events/{eventId}/accept" '{"comment": "Looking forward to it!", "sendResponse": true}'
```

## Decline

```bash
python3 scripts/graph_call.py POST "/me/events/{eventId}/decline" '{"comment": "Sorry, I have a conflict", "sendResponse": true}'
```

## Tentatively Accept

```bash
python3 scripts/graph_call.py POST "/me/events/{eventId}/tentativelyAccept" '{"comment": "Might be able to attend", "sendResponse": true}'
```

## Cancel Event (Organizer Only)

**SAFETY: Confirm — this notifies all attendees that the meeting is cancelled.**

```bash
python3 scripts/graph_call.py POST "/me/events/{eventId}/cancel" '{"comment": "Meeting cancelled — will reschedule"}'
```

All responses return 204 on success: `{"status": 204, "data": null}`.

For cancel vs delete guidance and response options, see [reference.md](reference.md).
