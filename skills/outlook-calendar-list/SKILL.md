---
name: outlook-calendar-list
description: List and view Outlook calendar events. Use when the user mentions calendar, schedule, meetings, what's on today, this week, next week, my events, what have I got, availability, free/busy, or asks about any upcoming appointments. Use proactively whenever dates or scheduling come up.
user_invocable: true
---

# List Calendar Events

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Fetch Events for a Date Range

Use `calendarView` — it expands recurring events into individual occurrences:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET \
  "/me/calendarView?startDateTime=YYYY-MM-DDTHH:MM:SS&endDateTime=YYYY-MM-DDTHH:MM:SS&\$top=50&\$orderby=start/dateTime&\$select=id,subject,start,end,location,organizer,attendees,isAllDay,isCancelled,showAs,isOnlineMeeting,categories" \
  --header "Prefer: outlook.timezone=\"Europe/London\""
```

**Always** request the user's timezone via the `Prefer` header — the API otherwise returns UTC, which makes day grouping incorrect. Default to `Europe/London`; adjust if the user indicates a different timezone. See [timezones](references/timezones.yaml) for valid values.

Response contains `data.value[]`. Use `@odata.nextLink` for pagination if present.

## Display Format

Group events by day, computing the day name from the actual date. Users care about *which day* something falls on — don't count sequentially from an assumed starting day.

Use this Python snippet to parse and display:

```python
import json, subprocess, sys
from datetime import datetime

data = json.loads(subprocess.run(
    [sys.executable, "scripts/graph_call.py", "GET",
     "/me/calendarView?startDateTime=START&endDateTime=END&$top=50&$orderby=start/dateTime"
     "&$select=id,subject,start,end,location,organizer,attendees,isAllDay,isCancelled,showAs,isOnlineMeeting,categories",
     "--header", "Prefer: outlook.timezone=\"Europe/London\""],
    capture_output=True, text=True
).stdout)["data"]

events = data.get("value", [])
current_day = None

for evt in events:
    dt_str = evt["start"]["dateTime"][:16]          # "2026-03-24T09:00"
    dt = datetime.fromisoformat(dt_str)
    day_label = dt.strftime("%A %-d %B")            # "Tuesday 24 March"

    if day_label != current_day:
        print(f"\n**{day_label}**")
        current_day = day_label

    start = dt.strftime("%-I:%M%p").lower()         # "9:00am"
    end   = datetime.fromisoformat(evt["end"]["dateTime"][:16]).strftime("%-I:%M%p").lower()
    subject = evt.get("subject", "(no subject)")
    cancelled = " ~~" if evt.get("isCancelled") else ""
    loc = evt.get("location", {}).get("displayName", "")
    online = " *(Teams)*" if evt.get("isOnlineMeeting") else (f" *({loc})*" if loc else "")

    print(f"- {start}–{end} · {cancelled}{subject}{cancelled}{online}")
```

Note: `%-d` and `%-I` remove leading zeros on Linux/Mac. On Windows use `%#d` and `%#I` instead.

## Presenting Results

Present events grouped by day using markdown, like:

```
**Tuesday 24 March**
- 9:00am–10:00am · Team standup *(Teams)*
- 2:00pm–3:00pm · ~~Cancelled: 1:1 with manager~~

**Wednesday 25 March**
- 10:30am–11:00am · Budget review *(Conference Room B)*
```

- Strike through cancelled events rather than hiding them — users often want to know something was scheduled
- Show location/Teams inline after the event name
- If the list is long (>15 events), summarise busy days and offer to drill in

## Answering Availability Questions

When the user asks "am I free on X?" or "do I have anything on Y afternoon?", list any events in that period, then follow with an explicit availability summary:
- State how many appointments they have in the period
- State the free windows between and around those appointments (e.g. "You are free between `<start>` and `<first event start>`, and after `<last event end>`")
- If the period has no events at all, say so clearly rather than leaving the user to infer it

The goal is that the user can read the answer without having to mentally calculate their own availability.

For today's events shortcut, search/filter queries, and additional field details: see [reference.md](reference.md).
