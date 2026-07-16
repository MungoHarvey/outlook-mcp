# Outlook Skills — Installation Guide

This guide covers installing the skills for **Claude Desktop / Cowork** (which
load skills from `~/.claude/skills/`). For Claude Code, prefer the plugin flow in
the root `README.md` (`cc --plugin-dir …`) — no copy step needed.

The auth system and Graph proxy stay in the cloned repo; the installer only
copies the skill folders out and rewrites their `${CLAUDE_PLUGIN_ROOT}` paths to
absolute repo locations.

## Prerequisites

- **Python 3.8+** — runs the Graph proxy (`scripts/graph_call.py`) and token helper
- **Node.js 18+** — runs the OAuth server (`outlook-skills/auth-server.js`)
- **Azure app registration** — client ID + secret (see `setup/AZURE_SETUP.md`)
- **Claude Desktop** or **Cowork** — loads skills from `~/.claude/skills/`

## Install

### macOS / Linux / WSL / Git Bash
```bash
bash setup/install.sh
```

### Windows (PowerShell)
```powershell
powershell -ExecutionPolicy Bypass -File setup\install.ps1
```

The installer is idempotent — re-running it refreshes the installed copies.

## What gets installed

| Location | Contents |
|----------|----------|
| `~/.claude/skills/outlook-*/` | 20 skill folders (SKILL.md, reference.md, params.yaml) |
| (in the cloned repo) `outlook-skills/` | Auth system (auth-server.js, token_helper.py, .env, tokens.json) |
| (in the cloned repo) `scripts/graph_call.py` | Secure Graph API proxy |

Shared reference YAML lives once in `~/.claude/skills/outlook-base/references/`;
other skills link to it.

## Custom install paths

```bash
INSTALL_DIR=/opt/outlook-mcp SKILLS_DIR=/custom/skills bash setup/install.sh
```
```powershell
.\setup\install.ps1 -InstallDir "D:\tools\outlook-mcp" -SkillsDir "D:\claude\skills"
```
`INSTALL_DIR` is where the auth/proxy live (defaults to the repo root);
`SKILLS_DIR` is where skill folders are copied (defaults to `~/.claude/skills`).

## Configure and authenticate

1. Create credentials (see `setup/AZURE_SETUP.md` for the Azure walkthrough).
   The **Web** redirect URI must be `http://localhost:8400/auth/callback`.
   ```bash
   cp outlook-skills/.env.example outlook-skills/.env   # then fill in OUTLOOK_CLIENT_ID / SECRET / TENANT_ID
   ```
2. Authenticate:
   ```bash
   bash outlook-skills/auth.sh          # or: .\outlook-skills\auth.ps1 on Windows
   ```

Tokens are written to `outlook-skills/tokens.json` (gitignored, permission-
restricted). The client secret stays in `.env`; it is not written to the token
file. See `outlook-skills/README.md` for the full auth/security model.

## Verify

```bash
# path rewriting worked (absolute path, not ${CLAUDE_PLUGIN_ROOT})
grep "graph_call.py" ~/.claude/skills/outlook-email-list/SKILL.md

# proxy runs against your mailbox (requires a valid token)
python3 scripts/graph_call.py GET "/me"
# Expected: {"status": 200, "data": {"displayName": "...", ...}}
```

## Uninstall

```bash
rm -rf ~/.claude/skills/outlook-*/     # installed skill folders
rm -f  outlook-skills/tokens.json      # stored tokens (also: auth.sh --revoke)
```

## Troubleshooting

- **`import_error` (503) from graph_call.py** — the Python deps couldn't load;
  run `pip install -r outlook-skills/requirements.txt`.
- **`auth_required`** — run `bash outlook-skills/auth.sh` (or `--reauth`).
- **AADSTS50011 (redirect mismatch)** — the Azure app's Web redirect URI must be
  exactly `http://localhost:8400/auth/callback`.
- **Skill not found** — confirm `~/.claude/skills/outlook-email-list/SKILL.md`
  exists with valid YAML frontmatter.
- **PowerShell execution policy** — use `-ExecutionPolicy Bypass` as shown above.
