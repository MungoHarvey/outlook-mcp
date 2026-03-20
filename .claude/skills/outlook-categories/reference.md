# Outlook Categories — Reference

## Color Presets

| Preset | Color |
|---|---|
| `none` | No color |
| `preset0` | Red |
| `preset1` | Orange |
| `preset2` | Brown |
| `preset3` | Yellow |
| `preset4` | Green |
| `preset5` | Teal |
| `preset6` | Olive |
| `preset7` | Blue |
| `preset8` | Purple |
| `preset9` | Cranberry |
| `preset10` | Steel |
| `preset11` | DarkSteel |
| `preset12` | Gray |
| `preset13` | DarkGray |
| `preset14` | Black |
| `preset15` | DarkRed |
| `preset16` | DarkOrange |
| `preset17` | DarkBrown |
| `preset18` | DarkYellow |
| `preset19` | DarkGreen |
| `preset20` | DarkTeal |
| `preset21` | DarkOlive |
| `preset22` | DarkBlue |
| `preset23` | DarkPurple |
| `preset24` | DarkCranberry |

## Applying Categories

### To a calendar event (create or update)
```bash
python3 scripts/graph_call.py PATCH "/me/events/{eventId}" '{"categories":["Red category","Work"]}'
```

### To an email message
```bash
python3 scripts/graph_call.py PATCH "/me/messages/{messageId}" '{"categories":["Important","Follow-up"]}'
```

## Error Handling

| Code | Meaning | Action |
|---|---|---|
| 401 | Token expired | Refresh and retry |
| 403 | Insufficient permissions | Check scopes |
