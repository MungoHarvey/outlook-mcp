# Calendar List — Reference

## calendarView vs /events

| Endpoint | Use When |
|---|---|
| `/me/calendarView` | Date-range queries — expands recurring events into individual occurrences ✓ preferred |
| `/me/events` | Listing without a date range, or when you need the master recurring event |

## Common Date Ranges

```python
from datetime import datetime, timedelta, timezone

now   = datetime.now()
today = now.replace(hour=0, minute=0, second=0, microsecond=0)

# Today
start = today.strftime("%Y-%m-%dT00:00:00")
end   = today.strftime("%Y-%m-%dT23:59:59")

# This week (Mon–Sun)
monday = today - timedelta(days=today.weekday())
end    = (monday + timedelta(days=7)).strftime("%Y-%m-%dT00:00:00")
start  = monday.strftime("%Y-%m-%dT00:00:00")

# Next N days from now
start = now.strftime("%Y-%m-%dT%H:%M:%S")
end   = (now + timedelta(days=N)).strftime("%Y-%m-%dT%H:%M:%S")
```

## Alternative: No Date Range

```bash
python3 scripts/graph_call.py GET \
  "/me/events?$top=10&$orderby=start/dateTime&$select=id,subject,start,end,location,organizer,isAllDay,showAs,categories"
```

## Searching for a Specific Event

Use `$filter` with `contains`:

```bash
python3 scripts/graph_call.py GET \
  "/me/events?$filter=contains(subject,'budget')&$select=id,subject,start,end,location"
```

## Day-of-Week Computation

Always derive the day name from the date itself — never count sequentially from an assumed starting day:

```python
from datetime import datetime
dt = datetime.fromisoformat("2026-03-24T09:00:00")
day_name = dt.strftime("%A")   # "Tuesday" — computed, never assumed
```

## Cross-Platform strftime

| Goal | Linux/Mac | Windows |
|---|---|---|
| Day without leading zero | `%-d` | `%#d` |
| Hour without leading zero | `%-I` | `%#I` |

## Attendee Formatting

```python
attendees = evt.get("attendees", [])
names = ", ".join(
    a.get("emailAddress", {}).get("name") or
    a.get("emailAddress", {}).get("address", "")
    for a in attendees[:5]
)
if len(attendees) > 5:
    names += f" +{len(attendees)-5} more"
```

## Error Handling

See [errors](references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 403 | Calendar may be read-only or insufficient permissions |
| 400 | startDateTime/endDateTime must be in ISO 8601 format |
