---
name: outlook-calendar-list
description: List and view Outlook calendar events. Use when user mentions calendar, schedule, meetings today, my events, what's on my calendar, availability, free/busy.
user_invocable: true
---

# List Calendar Events

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## List Events (Date Range)

Use `calendarView` for date-range queries (preferred — expands recurring events):

```bash
START=$(date -u +"%Y-%m-%dT%H:%M:%S.0000000")
END=$(date -u -d "+7 days" +"%Y-%m-%dT%H:%M:%S.0000000" 2>/dev/null || date -u -v+7d +"%Y-%m-%dT%H:%M:%S.0000000")

python3 scripts/graph_call.py GET "/me/calendarView?startDateTime=$START&endDateTime=$END&\$top=25&\$orderby=start/dateTime&\$select=id,subject,bodyPreview,start,end,location,organizer,attendees,isAllDay,isCancelled,showAs,categories,isOnlineMeeting" \
  --header "Prefer: outlook.timezone=\"America/New_York\""
```

Use `--header "Prefer: outlook.timezone=\"...\"` to get times in the user's timezone. See [timezones](references/timezones.yaml).

Response contains `data.value[]` with the events array. Use `@odata.nextLink` for pagination.

## Pagination

If the response contains `@odata.nextLink`, use that URL directly. See [graph-api-patterns](references/graph-api-patterns.yaml).

For parsing template and alternative listing approaches, see [reference.md](reference.md).
