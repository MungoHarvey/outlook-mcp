# Outlook Rules — Templates

## Move and Mark Read from Specific Senders

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "displayName": "Team notifications",
    "sequence": 75,
    "isEnabled": true,
    "conditions": {
      "fromAddresses": [
        {"emailAddress": {"address": "alice@example.com"}},
        {"emailAddress": {"address": "bob@example.com"}}
      ]
    },
    "actions": {
      "moveToFolder": "FOLDER_ID",
      "markAsRead": true
    }
  }' \
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules"
```

## Auto-Read by Subject Keyword

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "displayName": "Auto-read notifications",
    "sequence": 50,
    "isEnabled": true,
    "conditions": {
      "subjectContains": ["[Notification]", "[Auto]"]
    },
    "actions": {
      "markAsRead": true
    }
  }' \
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules"
```

## Forward and Stop Processing

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "displayName": "Forward urgent to team",
    "sequence": 10,
    "isEnabled": true,
    "conditions": {
      "importance": "high",
      "subjectContains": ["URGENT"]
    },
    "actions": {
      "forwardTo": [{"emailAddress": {"address": "team@example.com"}}],
      "stopProcessingRules": true
    }
  }' \
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules"
```

## Available Conditions

| Condition | Type | Description |
|---|---|---|
| `fromAddresses` | emailAddress[] | Match sender addresses |
| `senderContains` | string[] | Sender name/address contains |
| `subjectContains` | string[] | Subject contains |
| `bodyContains` | string[] | Body contains |
| `hasAttachments` | boolean | Has attachments |
| `importance` | string | Match importance (`low`, `normal`, `high`) |
| `isAutomaticForward` | boolean | Auto-forwarded emails |

## Available Actions

| Action | Type | Description |
|---|---|---|
| `moveToFolder` | string | Folder ID to move to |
| `copyToFolder` | string | Folder ID to copy to |
| `markAsRead` | boolean | Mark as read |
| `delete` | boolean | Delete the email |
| `forwardTo` | emailAddress[] | Forward to recipients |
| `markImportance` | string | Set importance level |
| `stopProcessingRules` | boolean | Stop further rule processing |
