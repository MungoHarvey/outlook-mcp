---
name: outlook-skills
description: "Microsoft Outlook integration — email, calendar, contacts, folders, and inbox rules via the Microsoft Graph API"
---

# Outlook Skills

These skills connect Claude to your Microsoft Outlook account — email, calendar, contacts, folders, and inbox rules — via the Microsoft Graph API.

## Prerequisites

The auth system must be installed before these skills will work. From the [outlook-mcp](https://github.com/MungoHarvey/outlook-mcp) project:

```bash
# macOS / Linux / WSL
bash setup/install.sh
bash ~/.skills/outlook-mcp/outlook-skills/auth.sh

# Windows (PowerShell)
.\setup\install.ps1
bash $env:USERPROFILE/.skills/outlook-mcp/outlook-skills/auth.sh
```

This installs the secure Python proxy and OAuth token system. Tokens are encrypted with AES-256 and stored in the OS keychain — never in plain text.

---

## Available Skills

### Email

| Skill folder | Trigger phrases | What it does |
|---|---|---|
| `outlook-email-list` | check inbox, unread emails, search email, find message | List, filter, and search emails across folders |
| `outlook-email-read` | read email, open message, show email, view email | Read full email content and attachments |
| `outlook-email-send` | send email, compose, write to, draft email | Compose and send new emails with CC/BCC |
| `outlook-email-reply` | reply, reply all, forward, respond to | Reply or forward existing emails |
| `outlook-email-move` | move email, file email, put in folder | Move emails between folders |
| `outlook-email-delete` | delete email, trash, remove message | Soft delete or permanently delete emails |
| `outlook-email-organize` | mark read, mark unread, flag, categorize | Bulk-organize emails |

### Calendar

| Skill folder | Trigger phrases | What it does |
|---|---|---|
| `outlook-calendar-list` | calendar, schedule, meetings today, what's on | View events by date range or day |
| `outlook-calendar-create` | schedule meeting, create event, book, add to calendar | Create single, recurring, all-day, or Teams events |
| `outlook-calendar-update` | reschedule, change meeting, update event, move to | Edit time, title, location, or attendees |
| `outlook-calendar-respond` | accept, decline, tentative, cancel meeting, RSVP | Respond to meeting invitations |

### Contacts

| Skill folder | Trigger phrases | What it does |
|---|---|---|
| `outlook-contacts-list` | contacts, address book, find contact, look up | Search and list contacts |
| `outlook-contacts-manage` | add contact, create contact, update contact | Create and edit contact records |

### Folders, Rules & Categories

| Skill folder | Trigger phrases | What it does |
|---|---|---|
| `outlook-folders` | mail folders, create folder, list folders | Create and manage mail folders |
| `outlook-rules` | inbox rules, email automation, auto-sort, filter | Create and list inbox rules |
| `outlook-categories` | categories, colour tags, labels | List available categories and colours |

---

## Authentication

Use the `outlook-auth` skill to manage your connection:

```
/outlook-auth           — check status or re-authenticate
/outlook-auth --reauth  — force a new browser login
/outlook-auth --status  — show session details without prompting
```

Tokens refresh automatically. Re-authentication is only needed after 30 days or if the refresh token is revoked.

---

## Skill Structure

Each skill folder uses progressive loading to stay lean:

```
outlook-email-list/
  SKILL.md        — core operation (~40-60 lines, always loaded)
  reference.md    — parsing templates, advanced filters, error handling
```

Skills with complex parameters also include `params.yaml` (calendar create, email send, contacts manage).

Shared data used across multiple skills lives in `outlook-references/`:

| File | Contents |
|---|---|
| `timezones.yaml` | IANA timezone identifiers |
| `colors.yaml` | Outlook category colour presets |
| `errors.yaml` | Graph API error codes and recovery steps |
| `graph-api-patterns.yaml` | Pagination, throttling, `$select`, `$filter` patterns |

---

## Safety

Destructive operations — sending email, deleting messages, cancelling events, creating rules — always ask for your explicit confirmation before executing.
