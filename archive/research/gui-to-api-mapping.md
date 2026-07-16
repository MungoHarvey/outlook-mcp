# GUI Feature to Graph API Property Mapping

Based on the Outlook web interface screenshot and Microsoft Graph API schema analysis.

## Direct Property Mappings (Easy Implementation)

| GUI Feature | Graph API Property | Type | Default | Validation |
|-------------|-------------------|------|---------|------------|
| **All day toggle** | `isAllDay` | boolean | false | true/false |
| **Teams meeting toggle** | `isOnlineMeeting` | boolean | false | When true, requires `onlineMeetingProvider` |
| **Teams meeting provider** | `onlineMeetingProvider` | string | null | "teamsForBusiness", "skypeForBusiness", "skypeForConsumer" |
| **Private toggle** | `sensitivity` | string | "normal" | "normal", "personal", "private", "confidential" |
| **Busy status** | `showAs` | string | "busy" | "free", "tentative", "busy", "oof", "workingElsewhere", "unknown" |
| **Reminder** | `reminderMinutesBeforeStart` | int | 15 | Any positive integer |
| **Response options** | `responseRequested` | boolean | true | true/false |
| **Hide attendees** | `hideAttendees` | boolean | false | true/false |
| **Time proposals** | `allowNewTimeProposals` | boolean | true | true/false |

## Categories Implementation

| GUI Feature | Graph API Property | Implementation Notes |
|-------------|-------------------|---------------------|
| **Categorise dropdown** | `categories` | String array. Categories must exist in user's master category list |

**Research needed**: 
- How to get/set user's available categories
- Category creation vs assignment
- Category colors/display properties

## Complex Property Mappings

### Location Enhancement
| GUI Feature | Graph API Property | Notes |
|-------------|-------------------|-------|
| **Room booking** | `location.uniqueId` | Email address of room resource |
| **Location name** | `location.displayName` | Human readable name |
| **Location type** | `location.locationType` | "default", "conferenceRoom", "homeAddress", etc. |
| **Address** | `location.address` | Full address object |
| **In-person event toggle** | Derived from location | Logic: hasLocation && !isOnlineMeeting |

### Recurrence Patterns
| GUI Feature | Graph API Property | Complexity |
|-------------|-------------------|------------|
| **Make recurring** | `recurrence` | High - complex nested object |
| **Recurrence type** | `recurrence.pattern.type` | "daily", "weekly", "monthly", "yearly" |
| **Recurrence interval** | `recurrence.pattern.interval` | Number (every N days/weeks/months) |
| **Days of week** | `recurrence.pattern.daysOfWeek` | Array for weekly patterns |
| **End date** | `recurrence.range.endDate` | Date when recurrence stops |

## Priority Implementation Order

### Phase 1: Quick Wins (1-2 days)
```javascript
// Add to create.js - these are simple boolean/string additions
isAllDay: args.isAllDay || false,
sensitivity: args.sensitivity || "normal", 
showAs: args.showAs || "busy",
reminderMinutesBeforeStart: args.reminderMinutesBeforeStart || 15,
responseRequested: args.responseRequested !== false, // Default true
hideAttendees: args.hideAttendees || false,
allowNewTimeProposals: args.allowNewTimeProposals !== false, // Default true
```

### Phase 2: Teams Integration (2-3 days)
```javascript  
// Teams meeting setup
isOnlineMeeting: args.isOnlineMeeting || false,
onlineMeetingProvider: args.isOnlineMeeting ? 
  (args.onlineMeetingProvider || "teamsForBusiness") : undefined
```

### Phase 3: Categories (3-4 days)
- Research category management APIs
- Implement category validation
- Add category creation if needed

### Phase 4: Enhanced Location (4-5 days)  
```javascript
// Enhanced location object
location: args.location ? {
  displayName: args.location.name || args.location,
  locationType: args.location.type || "default",
  uniqueId: args.location.email, // For room booking
  address: args.location.address
} : undefined
```

### Phase 5: Recurrence (7-10 days)
- Complex nested object structure  
- Multiple pattern types
- Date validation and calculation
- Exception handling

## API Testing Commands for Graph Explorer

### Test Basic Properties
```http
POST https://graph.microsoft.com/v1.0/me/events
Content-Type: application/json

{
  "subject": "Property Test Event",
  "start": { "dateTime": "2025-09-10T14:00:00", "timeZone": "UTC" },
  "end": { "dateTime": "2025-09-10T15:00:00", "timeZone": "UTC" },
  "isAllDay": false,
  "importance": "high",
  "sensitivity": "private", 
  "categories": ["Work", "Meeting"],
  "isOnlineMeeting": true,
  "onlineMeetingProvider": "teamsForBusiness",
  "showAs": "busy",
  "reminderMinutesBeforeStart": 30,
  "responseRequested": true,
  "hideAttendees": false,
  "allowNewTimeProposals": true
}
```

### Test Location Enhancement
```http
POST https://graph.microsoft.com/v1.0/me/events
Content-Type: application/json

{
  "subject": "Location Test Event", 
  "start": { "dateTime": "2025-09-10T14:00:00", "timeZone": "UTC" },
  "end": { "dateTime": "2025-09-10T15:00:00", "timeZone": "UTC" },
  "location": {
    "displayName": "Conference Room A",
    "locationType": "conferenceRoom", 
    "uniqueId": "room-a@company.com",
    "address": {
      "street": "123 Business Ave",
      "city": "Edinburgh",
      "state": "Scotland", 
      "countryOrRegion": "UK",
      "postalCode": "EH1 2NG"
    }
  }
}
```

## Research Action Items

1. **Test each property individually** in Graph Explorer
2. **Document validation errors** for invalid values  
3. **Test permission requirements** for new features
4. **Research category APIs** - how to manage user categories
5. **Test room booking workflow** - resource scheduling APIs
6. **Document recurrence patterns** - all supported types
7. **Test Teams meeting creation** - verify URL generation
8. **Check backwards compatibility** - ensure existing functionality preserved

## Implementation Validation Checklist

For each new property:
- [ ] Property tested in Graph Explorer ✓
- [ ] Validation rules documented ✓  
- [ ] Error handling implemented ✓
- [ ] Default values confirmed ✓
- [ ] Dependencies identified ✓
- [ ] Unit tests written ✓
- [ ] Integration tests written ✓
- [ ] Documentation updated ✓
