# One-Paste Setup Prompt

Copy the entire block below and paste it into a fresh **Claude Code** session (run `claude` in a terminal where you'd like the project cloned). Claude will clone the repo, install dependencies, prepare the project, then open a visual guide to walk you through Azure — and finish by authenticating and verifying access.

You only need to bring three values back from the Azure step: your **Client ID**, **Tenant ID**, and the **client secret value**. Claude handles the rest.

---

```text
You are helping me set up the Outlook Skills plugin (Microsoft Outlook integration
for Claude via the Microsoft Graph API) on my computer. Work through the steps below
ONE AT A TIME, confirming each succeeds before moving to the next. Detect my operating
system and adapt every command accordingly (Windows → PowerShell; macOS / Linux / WSL →
bash). Ask me before doing anything destructive. Never display, log, or echo my client
secret or any authentication token.

1. Detect my OS and confirm prerequisites are installed:
   - Node.js 18+   (node --version)
   - Python 3.10+  (python3 --version, or python --version on Windows)
   - git           (git --version)
   If any are missing, give me the official download link and stop until I confirm it's
   installed.

2. Clone the repository into the current directory (skip if an "outlook-mcp" folder is
   already here), then move into it:
       git clone https://github.com/MungoHarvey/outlook-mcp.git
       cd outlook-mcp

3. Install Node dependencies:
       npm install

4. Create my credentials file from the template (do NOT overwrite an existing .env):
   - macOS/Linux/WSL:  cp outlook-skills/.env.example outlook-skills/.env
   - Windows:          Copy-Item outlook-skills\.env.example outlook-skills\.env

5. I now need to register an Azure app to get my credentials. Open the visual setup guide
   in my default browser so I can follow the screenshots:
   - Windows:    Start-Process "setup/azure-setup-guide.html"
   - macOS:      open "setup/azure-setup-guide.html"
   - Linux/WSL:  xdg-open "setup/azure-setup-guide.html"
   Then summarise the 8 Azure steps for me in chat and tell me exactly which three values
   to bring back:
   - OUTLOOK_CLIENT_ID   (Application/client ID)
   - OUTLOOK_TENANT_ID   (use "common" for a personal Microsoft account)
   - the client secret VALUE  (the longer string — NOT the Secret ID, which causes
     error AADSTS7000215)

6. When I give you those three values, write them into outlook-skills/.env. Do not print
   my client secret back to me — just confirm it was saved. (.env is gitignored.)

7. Authenticate — a browser window opens for Microsoft sign-in:
   - macOS/Linux/WSL:  bash outlook-skills/auth.sh
   - Windows:          .\outlook-skills\auth.ps1

8. Verify access:
       python3 scripts/graph_call.py GET "/me"
   A 200 response with my profile means setup is complete. Then tell me I can load the
   plugin with:  cc --plugin-dir ./outlook-mcp
   and try "/outlook-email-list" or just ask you to "check my inbox".

All Microsoft Graph calls must go through scripts/graph_call.py — never read token files
directly. My credentials stay in outlook-skills/.env and tokens in
outlook-skills/tokens.json, both of which are gitignored and never leave my machine.
```

---

## Notes

- **Already have the plugin loaded?** Skip the paste prompt — just run `/outlook-setup` (or say "set up Outlook") and the bundled skill runs the same flow.
- The Azure step is the only part that needs you: registering the app and copying three values takes ~5 minutes. The [visual guide](azure-setup-guide.html) has annotated screenshots for every click.
- Re-running is safe: the prompt won't overwrite an existing `.env`, and auth can be refreshed any time with `auth.sh --reauth` / `auth.ps1 -Reauth`.
