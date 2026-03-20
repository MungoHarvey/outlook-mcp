#!/usr/bin/env python3
"""
outlook/outlook.py

Outlook / Mail skill using Microsoft Graph API.
Calls token_helper for auth — never handles tokens directly.

Available functions:
  list_messages(folder, limit)   — fetch recent emails
  send_message(to, subject, body) — send an email
  search_messages(query, limit)  — search mailbox
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Add skills root to path for shared imports
sys.path.insert(0, str(Path(__file__).parent))
from token_helper import get_token, AuthRequiredError

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


# ── Internal request helper ───────────────────────────────────────────────────

def _graph_request(method: str, endpoint: str, body: dict = None) -> dict:
    """
    Make an authenticated Microsoft Graph API call.
    Handles token injection — skills never touch tokens directly.
    """
    token = get_token()   # Raises AuthRequiredError if not authenticated

    url = f"{GRAPH_BASE}{endpoint}"
    data = json.dumps(body).encode() if body else None

    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type",  "application/json")
    req.add_header("Accept",        "application/json")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        raise RuntimeError(f"Graph API error {e.code}: {body_text}")


# ── Public skill functions ────────────────────────────────────────────────────

def list_messages(folder: str = "inbox", limit: int = 10) -> list[dict]:
    """
    Fetch recent messages from a mail folder.

    Args:
        folder: 'inbox', 'sentitems', 'drafts', 'deleteditems'
        limit:  number of messages to return (max 50)

    Returns:
        List of message dicts with keys:
          id, subject, from, receivedDateTime, bodyPreview, isRead
    """
    limit = min(limit, 50)
    data  = _graph_request("GET", f"/me/mailFolders/{folder}/messages"
                                  f"?$top={limit}&$orderby=receivedDateTime desc"
                                  f"&$select=id,subject,from,receivedDateTime,bodyPreview,isRead")
    return data.get("value", [])


def get_message(message_id: str) -> dict:
    """
    Fetch a single message by ID including full body.

    Returns:
        Full message dict including body.content
    """
    return _graph_request("GET", f"/me/messages/{message_id}")


def send_message(to: list[str], subject: str, body: str,
                 body_type: str = "Text", cc: list[str] = None) -> bool:
    """
    Send an email via Graph API.

    Args:
        to:        List of recipient email addresses
        subject:   Email subject line
        body:      Email body content
        body_type: 'Text' or 'HTML'
        cc:        Optional list of CC addresses

    Returns:
        True on success
    """
    recipients = [{"emailAddress": {"address": addr}} for addr in to]
    cc_list    = [{"emailAddress": {"address": addr}} for addr in (cc or [])]

    message = {
        "message": {
            "subject":      subject,
            "body":         {"contentType": body_type, "content": body},
            "toRecipients": recipients,
        },
        "saveToSentItems": True,
    }
    if cc_list:
        message["message"]["ccRecipients"] = cc_list

    _graph_request("POST", "/me/sendMail", message)
    return True


def search_messages(query: str, limit: int = 10) -> list[dict]:
    """
    Search the mailbox using Graph API search.

    Args:
        query: Search string (subject, body, sender, etc.)
        limit: Maximum results

    Returns:
        List of matching message dicts
    """
    import urllib.parse
    encoded_query = urllib.parse.quote(query)
    data = _graph_request("GET", f"/me/messages?$search=\"{encoded_query}\""
                                  f"&$top={limit}"
                                  f"&$select=id,subject,from,receivedDateTime,bodyPreview")
    return data.get("value", [])


def mark_as_read(message_id: str) -> bool:
    """Mark a message as read."""
    _graph_request("PATCH", f"/me/messages/{message_id}", {"isRead": True})
    return True


# ── CLI for testing ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        from token_helper import get_session_info
        info = get_session_info()
        if not info["authenticated"]:
            print("Not authenticated. Run: bash skills/azure-auth/auth.sh")
            sys.exit(1)

        print(f"Authenticated as: {info['user_email']} ({info['days_remaining']} days left)")
        print("\nFetching last 5 inbox messages...\n")

        messages = list_messages(limit=5)
        for msg in messages:
            sender  = msg.get("from", {}).get("emailAddress", {}).get("address", "unknown")
            subject = msg.get("subject", "(no subject)")
            date    = msg.get("receivedDateTime", "")[:10]
            read    = "" if msg.get("isRead") else " [unread]"
            print(f"  {date}  {sender:<35}  {subject}{read}")

    except AuthRequiredError as e:
        print(f"Auth required: {e}")
        sys.exit(1)
