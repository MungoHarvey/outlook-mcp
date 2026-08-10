---
name: outlook-setup
description: First-time setup of the Outlook Skills plugin on a new PC or Mac. Use when the user says "set up Outlook", "install Outlook skills", "configure Outlook", "get started with Outlook", "first time setup", "help me set this up", or runs /outlook-setup. Walks through prerequisites, install, Azure app registration (opens a visual HTML guide), credentials, and authentication.
---

# Outlook Skills — Guided Setup

Walk the user through end-to-end setup on their machine. Work **one step at a time**, confirm each succeeds before moving on, and adapt commands to their OS (Windows → PowerShell, macOS/Linux/WSL → bash).

Detailed per-OS commands, prerequisite installs, and troubleshooting: see [reference.md](reference.md).

## Step 0 — Detect environment
Determine the OS and confirm prerequisites are installed: **Node.js** (`node --version`), **Python 3** (`python3 --version` or `python --version`), and **git**. If any is missing, point the user to the install links in reference.md and stop until resolved.

## Step 1 — Get the plugin
If this skill is loaded, the plugin is already installed — skip to Step 2. Otherwise the user can install it one of two ways:
```
/plugin marketplace add MungoHarvey/outlook-mcp
/plugin install outlook-skills@outlook-mcp
```
or clone and load it directly:
```bash
git clone https://github.com/MungoHarvey/outlook-mcp.git
claude --plugin-dir ./outlook-mcp
```

## Step 2 — Choose where auth state lives
Credentials (`.env`) and tokens (`tokens.json`) are looked up in this order: `$OUTLOOK_SKILLS_HOME` → `${CLAUDE_PLUGIN_ROOT}/outlook-skills/` if it already holds state (cloned repo) → `~/.outlook-skills`.

- **Cloned repo:** use `outlook-skills/` inside the repo (the historic layout) — nothing to create.
- **Marketplace/plugin install:** use `~/.outlook-skills` so state survives plugin updates. Create it now: `mkdir -p ~/.outlook-skills` (PowerShell: `New-Item -ItemType Directory -Force "$env:USERPROFILE\.outlook-skills"`).

Call the chosen directory **STATE_DIR** in the steps below.

## Step 3 — Open the Azure setup guide
Azure App Registration is required so the plugin can talk to Microsoft Graph. **Open the visual HTML guide in the user's browser** — it has the 6 annotated screenshots:

- **Windows:** `Start-Process "$env:CLAUDE_PLUGIN_ROOT/setup/azure-setup-guide.html"`
- **macOS:** `open "${CLAUDE_PLUGIN_ROOT}/setup/azure-setup-guide.html"`
- **Linux / WSL:** `xdg-open "${CLAUDE_PLUGIN_ROOT}/setup/azure-setup-guide.html"`

Then summarise the 8 Azure steps inline (see reference.md → "Azure steps") so the user can follow along in chat too. The three values they must come away with:
`OUTLOOK_CLIENT_ID`, `OUTLOOK_TENANT_ID` (use `common` for personal accounts), and the **client secret VALUE** (not the Secret ID — that causes `AADSTS7000215`).

## Step 4 — Write credentials to `.env`
Create the credentials file in STATE_DIR from the bundled template, then fill in the three values:
```bash
cp "${CLAUDE_PLUGIN_ROOT}/outlook-skills/.env.example" STATE_DIR/.env                  # bash
Copy-Item "${CLAUDE_PLUGIN_ROOT}\outlook-skills\.env.example" STATE_DIR\.env           # PowerShell
```
Ask the user for the three values and write them into `STATE_DIR/.env`. **Do not echo the client secret back into the chat** — confirm only that it was written. `.env` is never committed (gitignored in the repo layout).

## Step 5 — Authenticate
```bash
bash "${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.sh"                       # macOS/Linux/WSL
powershell -File "${CLAUDE_PLUGIN_ROOT}/outlook-skills/auth.ps1"          # Windows PowerShell
```
A browser opens for Microsoft sign-in. On success, tokens are stored in `STATE_DIR/tokens.json` (owner-only permissions, never shown).

## Step 6 — Verify
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me"
```
A `200` with the user's profile means setup is complete. Then tell them they can try `/outlook-email-list` or "check my inbox".

## Safety
- Never display, log, or echo the client secret or any token.
- Credentials live only in `STATE_DIR/.env`; tokens only in `STATE_DIR/tokens.json` — never committed, never shown.
- If the user is uneasy entering the secret via chat, have them paste it directly into `STATE_DIR/.env` in their editor instead.
