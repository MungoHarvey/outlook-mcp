# Outlook Auth — Reference

## Azure App Registration Setup

If credentials are missing, guide the user through these steps:

### 1. Create App Registration
1. Go to https://portal.azure.com → Azure Active Directory → App registrations
2. Click "New registration"
3. Name: "Outlook Skills" (or any name)
4. Account type: "Accounts in any organizational directory and personal Microsoft accounts"
5. Redirect URI: Web → `http://localhost:8400/callback`
6. Click Register

### 2. Required API Permissions
Go to API permissions → Add a permission → Microsoft Graph → Delegated:
- `offline_access`
- `User.Read`
- `Mail.Read`
- `Mail.ReadWrite`
- `Mail.Send`
- `Calendars.Read`
- `Calendars.ReadWrite`
- `Contacts.Read`

### 3. Create Client Secret
Go to Certificates & secrets → New client secret → Copy the value immediately.

### 4. Configure ~/.skills/config.json
```json
{
  "outlook": {
    "client_id": "application-client-id-from-overview-page",
    "client_secret": "client-secret-value",
    "tenant_id": ""
  }
}
```
Leave `tenant_id` empty for personal accounts, or set it for organizational accounts.


## Organizational Accounts

For Microsoft 365 / organizational accounts:
1. Find Tenant ID: Azure Portal → Azure Active Directory → Overview → Tenant ID
2. Set in `.env`: `OUTLOOK_TENANT_ID=your-tenant-id`
3. Or set: `MS_TENANT_ID=your-tenant-id` (alternative variable)
