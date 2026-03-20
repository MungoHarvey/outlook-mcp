# Calendar List — Reference

## calendarView vs /events

| Endpoint | Use When |
|---|---|
| `/me/calendarView` | Date-range queries — expands recurring events into individual occurrences |
| `/me/events` | Listing all events without a date range, or when you need the master recurring event |

## Alternative Listing (No Date Range)

```bash
python3 scripts/graph_call.py GET "/me/events?$top=10&$orderby=start/dateTime&$select=id,subject,start,end,location,organizer,attendees,isAllDay,showAs,categories"
```

## Parsing Template

```bash
python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, evt in enumerate(data.get('value', []), 1):
    start = evt.get('start', {}).get('dateTime', '')[:16]
    end = evt.get('end', {}).get('dateTime', '')[:16]
    loc = evt.get('location', {}).get('displayName', '')
    cancelled = ' [CANCELLED]' if evt.get('isCancelled') else ''
    allday = ' [ALL DAY]' if evt.get('isAllDay') else ''
    online = ' [TEAMS]' if evt.get('isOnlineMeeting') else ''
    print(f\"{i}. {evt.get('subject', '(no subject)')}{cancelled}{allday}{online}\")
    print(f\"   {start} — {end}\")
    if loc:
        print(f\"   Location: {loc}\")
    attendees = evt.get('attendees', [])
    if attendees:
        names = ', '.join(a.get('emailAddress', {}).get('name', a.get('emailAddress', {}).get('address', '')) for a in attendees[:5])
        print(f\"   Attendees: {names}{'...' if len(attendees) > 5 else ''}\")
    cats = evt.get('categories', [])
    if cats:
        print(f\"   Categories: {', '.join(cats)}\")
    print(f\"   Show as: {evt.get('showAs', 'busy')}\")
    print(f\"   ID: {evt.get('id')}\")
    print()
next_link = data.get('@odata.nextLink')
if next_link:
    print(f'More results available. Next page: {next_link}')
"
```

## Today's Events Shortcut

```bash
START=$(date -u +"%Y-%m-%dT00:00:00.0000000")
END=$(date -u +"%Y-%m-%dT23:59:59.0000000")
```

## Error Handling

See [errors](../outlook-references/errors.yaml) for common HTTP error codes.

| Code | Specific Meaning |
|---|---|
| 403 | Calendar may be read-only or insufficient permissions |
