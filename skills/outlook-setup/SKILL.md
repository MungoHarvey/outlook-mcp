---
name: outlook-setup
description: First-time setup of the Outlook Skills plugin on a new PC or Mac. Use when the user says "set up Outlook", "install Outlook skills", "configure Outlook", "get started with Outlook", "first time setup", "help me set this up", or runs /outlook-setup. Walks through prerequisites, install, Azure app registration (opens a visual HTML guide), credentials, and authentication.
user_invocable: true
---

# Outlook Skills — Guided Setup

Walk the user through end-to-end setup on their machine. Work **one step at a time**, confirm each succeeds before moving on, and adapt commands to their OS (Windows → PowerShell, macOS/Linux/WSL → bash).

Detailed per-OS commands, prerequisite installs, and troubleshooting: see [reference.md](reference.md).

## Step 0 — Detect environment
Determine the OS and confirm prerequisites are installed: **Node.js** (`node --version`), **Python 3** (`python3 --version` or `python --version`), and **git**. If any is missing, point the user to the install links in reference.md and stop until resolved.

## Step 1 — Get the repository
If you are already running inside the cloned repo (this skill is loaded), skip to Step 2. Otherwise have the user clone it and load it as a plugin:
```bash
git clone https://github.com/MungoHarvey/outlook-mcp.git
cc --plugin-dir ./outlook-mcp
```

## Step 2 — Install dependencies
From the repo root:
```bash
npm install
```

## Step 3 — Open the Azure setup guide
Azure App Registration is required so the plugin can talk to Microsoft Graph. **Open the visual HTML guide in the user's browser** — it has the 6 annotated screenshots:

- **Windows:** `Start-Process "$env:CLAUDE_PLUGIN_ROOT/setup/azure-setup-guide.html"`
- **macOS:** `open "${CLAUDE_PLUGIN_ROOT}/setup/azure-setup-guide.html"`
- **Linux / WSL:** `xdg-open "${CLAUDE_PLUGIN_ROOT}/setup/azure-setup-guide.html"`

Then summarise the 8 Azure steps inline (see reference.md → "Azure steps") so the user can follow along in chat too. The three values they must come away with:
`OUTLOOK_CLIENT_ID`, `OUTLOOK_TENANT_ID` (use `common` for personal accounts), and the **client secret VALUE** (not the Secret ID — that causes `AADSTS7000215`).

## Step 4 — Write credentials to `.env`
Create the gitignored credentials file from the template, then fill in the three values:
```bash
cp outlook-skills/.env.example outlook-skills/.env       # bash
Copy-Item outlook-skills\.env.example outlook-skills\.env # PowerShell
```
Ask the user for the three values and write them into `outlook-skills/.env`. **Do not echo the client secret back into the chat** — confirm only that it was written. `.env` is gitignored.

## Step 5 — Authenticate
```bash
bash ${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh        # macOS/Linux/WSL
.\outlook-skills\auth.ps1                                # Windows PowerShell
```
A browser opens for Microsoft sign-in. On success, tokens are stored in `outlook-skills/tokens.json` (gitignored, never shown).

## Step 6 — Verify
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me"
```
A `200` with the user's profile means setup is complete. Then tell them they can try `/outlook-email-list` or "check my inbox".

## Safety
- Never display, log, or echo the client secret or any token.
- Credentials live only in `outlook-skills/.env`; tokens only in `outlook-skills/tokens.json` — both gitignored.
- If the user is uneasy entering the secret via chat, have them paste it directly into `outlook-skills/.env` in their editor instead.
