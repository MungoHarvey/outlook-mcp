#!/usr/bin/env python3
"""
calendar/calendar_skill.py

Calendar skill using Microsoft Graph API.
Calls token_helper for auth — never handles tokens directly.

Available functions:
  list_events(days_ahead, limit)          — upcoming calendar events
  create_event(subject, start, end, ...)  — create a calendar event
  get_event(event_id)                     — fetch single event
  delete_event(event_id)                  — delete an event
"""

import json
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from token_helper import get_token, AuthRequiredError

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _graph_request(method: str, endpoint: str, body: dict = None) -> dict:
    token = get_token()
    url   = f"{GRAPH_BASE}{endpoint}"
    data  = json.dumps(body).encode() if body else None

    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type",  "application/json")
    req.add_header("Accept",        "application/json")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Graph API error {e.code}: {e.read().decode()}")


def list_events(days_ahead: int = 7, limit: int = 10) -> list[dict]:
    """
    Fetch upcoming calendar events.

    Args:
        days_ahead: How many days into the future to look
        limit:      Maximum events to return

    Returns:
        List of event dicts with subject, start, end, location, organizer
    """
    now   = datetime.now(timezone.utc)
    end   = now + timedelta(days=days_ahead)
    start_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_str   = end.strftime("%Y-%m-%dT%H:%M:%SZ")

    params = urllib.parse.urlencode({
        "startDateTime": start_str,
        "endDateTime":   end_str,
        "$top":          min(limit, 50),
        "$orderby":      "start/dateTime",
        "$select":       "id,subject,start,end,location,organizer,isAllDay,bodyPreview",
    })

    data = _graph_request("GET", f"/me/calendarView?{params}")
    return data.get("value", [])


def get_event(event_id: str) -> dict:
    """Fetch a single calendar event by ID."""
    return _graph_request("GET", f"/me/events/{event_id}")


def create_event(subject: str, start: str, end: str,
                 timezone_str: str = "UTC",
                 body: str = "", location: str = "",
                 attendees: list[str] = None,
                 is_all_day: bool = False) -> dict:
    """
    Create a calendar event.

    Args:
        subject:      Event title
        start:        ISO 8601 datetime string e.g. '2025-06-01T10:00:00'
        end:          ISO 8601 datetime string
        timezone_str: IANA timezone e.g. 'Europe/London'
        body:         Optional event description
        location:     Optional location string
        attendees:    Optional list of email addresses to invite
        is_all_day:   Set True for all-day events

    Returns:
        Created event dict (includes 'id' for future reference)
    """
    event = {
        "subject":   subject,
        "isAllDay":  is_all_day,
        "start":     {"dateTime": start, "timeZone": timezone_str},
        "end":       {"dateTime": end,   "timeZone": timezone_str},
    }

    if body:
        event["body"] = {"contentType": "Text", "content": body}

    if location:
        event["location"] = {"displayName": location}

    if attendees:
        event["attendees"] = [
            {"emailAddress": {"address": addr}, "type": "required"}
            for addr in attendees
        ]

    return _graph_request("POST", "/me/events", event)


def delete_event(event_id: str) -> bool:
    """Delete a calendar event by ID."""
    _graph_request("DELETE", f"/me/events/{event_id}")
    return True


def update_event(event_id: str, updates: dict) -> dict:
    """
    Partially update an event.

    Args:
        event_id: Event ID
        updates:  Dict of fields to update (subject, start, end, body, etc.)
    """
    return _graph_request("PATCH", f"/me/events/{event_id}", updates)


if __name__ == "__main__":
    try:
        from token_helper import get_session_info
        info = get_session_info()
        if not info["authenticated"]:
            print("Not authenticated. Run: bash skills/azure-auth/auth.sh")
            sys.exit(1)

        print(f"Authenticated as: {info['user_email']}")
        print("\nUpcoming events (next 7 days):\n")

        events = list_events(days_ahead=7, limit=10)
        if not events:
            print("  No upcoming events.")
        for evt in events:
            start   = evt.get("start", {}).get("dateTime", "")[:16].replace("T", " ")
            subject = evt.get("subject", "(no subject)")
            loc     = evt.get("location", {}).get("displayName", "")
            loc_str = f"  @ {loc}" if loc else ""
            print(f"  {start}  {subject}{loc_str}")

    except AuthRequiredError as e:
        print(f"Auth required: {e}")
        sys.exit(1)
