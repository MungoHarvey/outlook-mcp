---
name: outlook-auth
description: Authenticate with Microsoft Outlook. Use when user says "connect to Outlook", "sign in to email", "authenticate", or runs /outlook-auth.
---

# Outlook Authentication

Manages OAuth 2.0 authentication with Microsoft Graph API.

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

Use the command for the user's platform. On Windows run the `.ps1` launcher from PowerShell — never `bash` from PowerShell, which runs WSL, and WSL cannot read Windows paths.

## Check Status

```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh --status
```
```powershell
powershell -NoProfile -File "${CLAUDE_PLUGIN_ROOT}\outlook-skills\auth.ps1" -Status
```

Prints a human-readable summary, never token contents. With no tokens it prints `Not authenticated. Run: …` with the re-auth command; otherwise it prints the user, session age, access-token validity (valid, or expired and auto-refreshing), granted scopes and the token file.

## Initial Authentication

```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh
```
```powershell
powershell -NoProfile -File "${CLAUDE_PLUGIN_ROOT}\outlook-skills\auth.ps1"
```

Opens your default browser to authenticate with Microsoft Outlook. Tokens are stored in the auth state directory, chosen in this order: `$OUTLOOK_SKILLS_HOME` (if set and non-empty) → `~/.outlook-skills` if it holds a `.env` or `tokens.json` → the plugin's `outlook-skills/` folder, only if it holds `tokens.json` (legacy cloned-repo layout; a `.env` alone there does not count) → otherwise `~/.outlook-skills`, where new state is created. Never committed, never shown.

If you need to force a new login:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh --reauth
```
```powershell
powershell -NoProfile -File "${CLAUDE_PLUGIN_ROOT}\outlook-skills\auth.ps1" -Reauth
```

## When Auth Fails

First run the platform's `--where` / `-Where` and report the checked directories to the user (paths only, no secrets):
```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh --where
```
```powershell
powershell -NoProfile -File "${CLAUDE_PLUGIN_ROOT}\outlook-skills\auth.ps1" -Where
```
If `.env` is missing, **never suggest registering a new Azure app**. Ask whether the user already has a working app: if so, they copy their existing `.env` into the chosen state directory (see [README, "Moving existing credentials to `~/.outlook-skills`"](../../README.md)). Registering a new app is only for first-time setup.

## Verify API Access

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me"
```

If this returns status 200 with your user profile, authentication is working. Any 401 error means tokens need refresh.

## Revoke Tokens

```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh --revoke
```
```powershell
powershell -NoProfile -File "${CLAUDE_PLUGIN_ROOT}\outlook-skills\auth.ps1" -Revoke
```

This clears your stored tokens and requires re-authentication.

## Safety
- Never attempt to read tokens directly or import the token helper module — always use `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py`
- Token file is gitignored; never display or ask the user for token content
- Azure app credentials (`OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`) must be in `.gitignore`
