# Outlook Skills — Installation Guide

## Prerequisites

- **Python 3.8+** — required for the Graph API proxy and token management
- **Azure AD app registration** — client ID and secret for Microsoft Graph API access
- **Claude Desktop** or **Claude Cowork** — skills are loaded from `~/.claude/skills/`
- **Git Bash or WSL** (Windows) — required to run `auth.sh` after installation

## Quick Start

### macOS / Linux / WSL

```bash
bash setup/install.sh
bash ~/.skills/outlook-mcp/outlook-skills/auth.sh
```

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File setup\install.ps1
bash $env:USERPROFILE\.skills\outlook-mcp\outlook-skills\auth.sh
```

## What Gets Installed

| Location | Contents |
|----------|----------|
| `~/.claude/skills/outlook-*/` | 17 skill folders — SKILL.md and reference.md files |
| `~/.claude/skills/outlook-references/` | Shared YAML data (timezones, colors, error codes) |
| `~/.skills/outlook-mcp/outlook-skills/` | Python auth system (auth.sh, token_helper.py, etc.) |
| `~/.skills/outlook-mcp/scripts/graph_call.py` | Secure Graph API proxy |

Path references inside installed skill files are rewritten at install time to use absolute paths, so skills work regardless of the working directory.

## Custom Install Paths

Override the default directories via environment variables (bash) or parameters (PowerShell):

```bash
# Bash
INSTALL_DIR=/opt/outlook-mcp SKILLS_DIR=/custom/skills bash setup/install.sh
```

```powershell
# PowerShell
.\setup\install.ps1 -InstallDir "D:\tools\outlook-mcp" -SkillsDir "D:\claude\skills"
```

## Configuration

### Azure AD App Registration

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. Create a new registration (single tenant or multitenant)
3. Add a redirect URI: `http://localhost:8400/callback`
4. Create a client secret under **Certificates & secrets**
5. Note your **Application (client) ID** and the secret value

Create `~/.skills/config.json`:
```json
{
  "tenant_id": "common",
  "client_id": "your-application-client-id"
}
```

Use `"tenant_id": "common"` for personal Microsoft accounts, or your Azure tenant ID for organisational accounts. The client secret is prompted during `auth.sh` and stored in the OS keychain — it is never written to disk.

### Claude Desktop

Claude Desktop automatically loads skills from `~/.claude/skills/`. No additional configuration is needed after running the installer.

To verify skills are loaded, open Claude Desktop and type `/outlook-email-list` — it should offer to list your inbox.

### Claude Cowork

Skills in `~/.claude/skills/` are available globally across all projects. To restrict skills to a specific project, copy the installed skill folders into `.claude/skills/` within your project directory instead.

## Authentication

After installation, run the auth script to connect to your Microsoft account:

```bash
bash ~/.skills/outlook-mcp/outlook-skills/auth.sh
```

This opens a browser window for OAuth 2.0 + PKCE authentication. After signing in:
- Tokens are encrypted with AES-256 Fernet and stored in the OS keychain
- The encryption key is stored separately in Windows Credential Manager (Windows) or macOS Keychain
- Tokens are refreshed automatically — re-authentication is only needed after expiry

## Verification

After installing and authenticating, run these checks:

```bash
# 1. Confirm path rewriting worked
grep "graph_call.py" ~/.claude/skills/outlook-email-list/SKILL.md
# Expected: absolute path like ~/.skills/outlook-mcp/scripts/graph_call.py

# 2. Confirm auth system is present
ls ~/.skills/outlook-mcp/outlook-skills/
# Expected: auth.sh, token_helper.py, requirements.txt, etc.

# 3. Confirm proxy is runnable
python3 ~/.skills/outlook-mcp/scripts/graph_call.py --help
# Expected: argparse help output

# 4. Live test (requires valid token)
python3 ~/.skills/outlook-mcp/scripts/graph_call.py GET "/me"
# Expected: {"status": 200, "data": {"displayName": "...", ...}}
```

## Uninstall

```bash
# Remove auth system and proxy
rm -rf ~/.skills/outlook-mcp/

# Remove skill files
rm -rf ~/.claude/skills/outlook-*/
rm -rf ~/.claude/skills/outlook-references/

# Remove stored tokens (optional)
# Windows: search "outlook-mcp" in Windows Credential Manager
# macOS: search "outlook-mcp" in Keychain Access
```

## Troubleshooting

**`venv_missing` error when calling graph_call.py**
Run `bash ~/.skills/outlook-mcp/outlook-skills/auth.sh` to set up the Python virtual environment.

**`auth_required` error**
Run `bash ~/.skills/outlook-mcp/outlook-skills/auth.sh` to authenticate.

**Skill not found in Claude Desktop**
Verify the skill folder exists at `~/.claude/skills/outlook-email-list/` and contains a `SKILL.md` file with valid YAML frontmatter.

**PowerShell execution policy error**
Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` or use `-ExecutionPolicy Bypass` flag as shown in the Quick Start.
