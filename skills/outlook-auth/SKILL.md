---
name: outlook-auth
description: Authenticate with Microsoft Outlook. Use when user says "connect to Outlook", "sign in to email", "authenticate", or runs /outlook-auth.
user_invocable: true
---

# Outlook Authentication

Manages OAuth 2.0 authentication with Microsoft Graph API.

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## Check Status

```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh --status
```

Returns `VALID`, `EXPIRED`, or `NO_TOKEN`.

## Initial Authentication

```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh
```

Opens your default browser to authenticate with Microsoft Outlook. Tokens are stored in `outlook-skills/tokens.json` (gitignored).

If you need to force a new login:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh --reauth
```

## Verify API Access

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me"
```

If this returns status 200 with your user profile, authentication is working. Any 401 error means tokens need refresh.

## Revoke Tokens

```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh --revoke
```

This clears your stored tokens and requires re-authentication.

## Safety
- Never attempt to read tokens directly or import the token helper module — always use `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py`
- Token file is gitignored; never display or ask the user for token content
- Azure app credentials (`OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`) must be in `.gitignore`
