# User Configuration Guide

This document explains how to configure timezone and date formatting for the Outlook MCP server.

## Configuration System

The server uses a clean two-file configuration system:

- **`user-configs/user-preferences.json`** - Simple file for users to edit their preferences
- **`user-configs/location-formats.json`** - Extensive format options for different locations (managed by the system)

### 1. Quick Setup

Edit the user preferences file to select your location and preferred format styles:

```json
{
  "location": "uk",
  "dateStyle": "medium",
  "timeStyle": "short",
  "datetimeStyle": "medium"
}
```

That's it! The system will automatically use the appropriate timezone, locale, and formatting for your selected location.

### 2. Available Locations

The following locations are currently supported:

| Location ID | Country/Region | Timezone | Example Format |
|-------------|---------------|----------|----------------|
| `uk` | United Kingdom | Europe/London | Tue, 15 Sept 2025 14:30 |
| `us` | United States (East) | America/New_York | Tue, Sep 15, 2025 2:30 PM |
| `us-central` | United States (Central) | America/Chicago | Tue, Sep 15, 2025 1:30 PM |
| `us-pacific` | United States (Pacific) | America/Los_Angeles | Tue, Sep 15, 2025 11:30 AM |
| `germany` | Germany | Europe/Berlin | Di., 15. Sep. 2025 14:30 |
| `france` | France | Europe/Paris | mar. 15 sept. 2025 14:30 |
| `japan` | Japan | Asia/Tokyo | 2025年9月15日(月) 14:30 |
| `australia` | Australia | Australia/Sydney | Tue, 15 Sep 2025 14:30 |
| `canada` | Canada | America/Toronto | Tue, Sep 15, 2025 2:30 PM |
| `india` | India | Asia/Kolkata | Tue, 15 Sep 2025 14:30 |

### 3. Format Styles

Each location supports three format styles:

- **`short`**: Compact format (e.g., "15/09/2025 14:30")
- **`medium`**: Standard format (e.g., "Tue, 15 Sept 2025 14:30") - **Recommended**
- **`long`**: Detailed format (e.g., "Tuesday, 15 September 2025 at 14:30:45")

You can set different styles for different types of content:
- `dateStyle`: Used for dates only
- `timeStyle`: Used for times only
- `datetimeStyle`: Used for combined date and time

### 4. Daylight Saving Time (DST) Handling

The system automatically handles DST for locations that observe it:

- **UK**: Automatically shows "BST" indicator when British Summer Time is in effect
- **US**: Handles EST/EDT transitions automatically
- **EU Countries**: Handles CET/CEST transitions automatically
- **Other Locations**: DST is handled according to local timezone rules

When DST is active, times will be displayed with the correct offset and may include indicators like "(BST)" for clarity.

#### Manual Timezone Offset Override

If you need to override the automatic DST detection, you can set:

```json
{
  "timezoneOffset": "+01:00"
}
```

Options:
- `"auto"` (default): Automatic DST detection
- `"+01:00"`: Force UTC+1 offset
- `"+00:00"`: Force UTC+0 offset
- `"-05:00"`: Force UTC-5 offset

### 5. Examples

#### UK User (Default)
```json
{
  "location": "uk",
  "dateStyle": "medium",
  "timeStyle": "short",
  "datetimeStyle": "medium"
}
```
Results in: `Tue, 15 Sept 2025 14:30`

#### US User
```json
{
  "location": "us",
  "dateStyle": "medium",
  "timeStyle": "short",
  "datetimeStyle": "medium"
}
```
Results in: `Tue, Sep 15, 2025 2:30 PM`

#### German User
```json
{
  "location": "germany",
  "dateStyle": "medium",
  "timeStyle": "short",
  "datetimeStyle": "medium"
}
```
Results in: `Di., 15. Sep. 2025 14:30`

### 6. How It Works

1. **Load Preferences**: Server reads `user-configs/user-preferences.json`
2. **Find Location**: Looks up your selected location in `user-configs/location-formats.json`
3. **Apply Settings**: Uses the timezone, locale, and formats for that location
4. **Format Dates**: All date/time formatting uses your preferences automatically
5. **DST Handling**: Automatically detects and handles daylight saving time
6. **Fallback**: If configuration files are missing or invalid, uses UK defaults

### 7. Advanced Configuration

The `location-formats.json` file contains detailed formatting options using `Intl.DateTimeFormat`. You can modify this file to:

- Add new locations
- Customize existing location formats
- Add new format styles
- Adjust locale settings

### 8. Troubleshooting

- **Location not found**: Check spelling in `user-preferences.json` matches entries in `location-formats.json`
- **Invalid format style**: Use only "short", "medium", or "long"
- **Files not found**: Ensure both files exist in the `user-configs/` folder
- **DST Issues**: Check that your timezone is correctly set and DST is being detected
- **Wrong Time**: Verify your location setting and timezone offset
- **Changes not applied**: Restart the server after making changes

### 9. Adding New Locations

To add a new location to `location-formats.json`:

```json
"your-location": {
  "name": "Your Country Name",
  "timezone": "Your/Timezone",
  "locale": "your-locale",
  "formats": {
    "date": {
      "short": { "year": "numeric", "month": "2-digit", "day": "2-digit" },
      "medium": { "weekday": "short", "year": "numeric", "month": "short", "day": "numeric" },
      "long": { "weekday": "long", "year": "numeric", "month": "long", "day": "numeric" }
    },
    "time": {
      "short": { "hour": "2-digit", "minute": "2-digit" },
      "long": { "hour": "2-digit", "minute": "2-digit", "second": "2-digit" }
    },
    "datetime": {
      "short": { "year": "numeric", "month": "2-digit", "day": "2-digit", "hour": "2-digit", "minute": "2-digit" },
      "medium": { "weekday": "short", "year": "numeric", "month": "short", "day": "numeric", "hour": "2-digit", "minute": "2-digit" },
      "long": { "weekday": "long", "year": "numeric", "month": "long", "day": "numeric", "hour": "2-digit", "minute": "2-digit", "second": "2-digit" }
    }
  }
}
```

Use valid IANA timezone names and BCP 47 locale identifiers.
