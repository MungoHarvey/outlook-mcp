---
name: outlook-folders
description: Manage Outlook mail folders — list, create, move emails. Use when user mentions mail folders, organizing email, moving emails, creating folders.
user_invocable: true
---

# Outlook Mail Folders

Manage mail folders through Microsoft Graph API.

Shared patterns: see [outlook-base](../outlook-base/SKILL.md)

## List Folders

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py GET "/me/mailFolders?\$select=id,displayName,totalItemCount,unreadItemCount"
```

For child folders and parsing template, see [reference.md](reference.md).

## Create Folder

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/mailFolders" '{"displayName":"FolderName"}'
```

Subfolder:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/mailFolders/{parentFolderId}/childFolders" '{"displayName":"SubfolderName"}'
```

## Move Emails

**SAFETY: Confirm with user before moving, showing email subjects and target folder.**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/graph_call.py POST "/me/messages/{messageId}/move" '{"destinationId":"TARGET_FOLDER_ID"}'
```

Well-known folder names usable as IDs: `inbox`, `drafts`, `sentitems`, `deleteditems`, `junkemail`, `archive`, `outbox`

For folder name resolution and batch moves, see [reference.md](reference.md).
