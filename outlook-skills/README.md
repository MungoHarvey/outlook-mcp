# Skills Repo

Microsoft 365 skills for Claude Code / AI agents, with secure local token storage.

## Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/yourname/skills-repo.git
cd skills-repo
```

### 2. Register an Azure app
1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**
2. Name it anything (e.g. `my-skills`)
3. Set redirect URI: **Web** → `http://localhost:8400/callback`
4. After creation, note your **Tenant ID** and **Application (client) ID**
5. Go to **Certificates & secrets** → **New client secret** → copy the value
6. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated**:
   - `Mail.Read`, `Mail.Send`, `Calendars.ReadWrite`, `User.Read`, `offline_access`
7. Click **Grant admin consent** (if you have admin rights) — otherwise users will be prompted

### 3. Create your config
```bash
cp skills/azure-auth/config.example.json ~/.skills/config.json
# Edit ~/.skills/config.json with your tenant_id, client_id, client_secret
```

### 4. Authenticate
```bash
bash skills/azure-auth/auth.sh
```
A browser window will open. Sign in with your Microsoft account and approve permissions.
Your tokens are encrypted and stored locally. Done.

### 5. Use the skills
```python
from skills.outlook.outlook import list_messages, send_message
from skills.calendar.calendar_skill import list_events, create_event

# List recent emails
messages = list_messages(limit=5)

# List upcoming calendar events
events = list_events(days_ahead=7)
```

---

## Skills

| Skill | Description | Auth required |
|---|---|---|
| `azure-auth` | One-time auth setup | — |
| `outlook` | Read, send, search email | ✓ |
| `calendar` | View and create calendar events | ✓ |

## Session Management

| Action | Command |
|---|---|
| Check status | `bash skills/azure-auth/auth.sh --status` |
| Force re-login | `bash skills/azure-auth/auth.sh --reauth` |
| Revoke access | `bash skills/azure-auth/auth.sh --revoke` |

Sessions expire after **30 days** and require re-authentication.

## Security

- Tokens are AES-256 encrypted at rest (`~/.skills/tokens.enc`)
- Encryption key lives in the OS keychain — never on disk
- OAuth uses PKCE on every flow — no implicit grants
- `~/.skills/` directory is created with `chmod 700`
- Minimal scopes by default — request only what you need
