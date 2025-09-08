# Microsoft Graph API Endpoints Research Checklist

## Primary Event Management APIs

### ✅ Currently Implemented
- `GET /me/events` - List events ✓
- `POST /me/events` - Create events (basic) ✓  
- `DELETE /me/events/{id}` - Delete events ✓
- `POST /me/events/{id}/decline` - Decline events ✓
- `POST /me/events/{id}/cancel` - Cancel events ✓

### 🔄 Need Enhancement  
- `POST /me/events` - **Enhance with all new properties**
- `PATCH /me/events/{id}` - **Add update functionality** 
- `POST /me/events/{id}/accept` - Accept events
- `POST /me/events/{id}/tentativelyaccept` - Tentative accept

### ❌ Missing APIs to Research

#### Event Management
- `GET /me/events/{id}` - Get single event details
- `POST /me/events/{id}/forward` - Forward events  
- `GET /me/events/{id}/instances` - Get recurring event instances
- `POST /me/events/{id}/dismissReminder` - Dismiss reminders
- `POST /me/events/{id}/snoozeReminder` - Snooze reminders

#### Calendar Management  
- `GET /me/calendars` - List user's calendars
- `GET /me/calendar` - Get default calendar
- `POST /me/calendars` - Create new calendars
- `GET /me/calendarGroups` - List calendar groups

#### Category Management
- `GET /me/outlook/masterCategories` - **Critical for categories feature**
- `POST /me/outlook/masterCategories` - Create new categories  
- `PATCH /me/outlook/masterCategories/{id}` - Update categories
- `DELETE /me/outlook/masterCategories/{id}` - Delete categories

#### Room and Resource Booking
- `POST /me/calendar/getSchedule` - **Check room availability**  
- `GET /me/places` - **List available rooms/resources**
- `GET /me/places/{id}` - Get room details

#### Free/Busy Information
- `POST /me/calendar/getSchedule` - Get free/busy times
- `GET /me/calendarView` - Calendar view with free/busy

## Supporting Resource APIs

### Attachment Management (Already Basic Support)
- `GET /me/events/{id}/attachments` - List attachments
- `POST /me/events/{id}/attachments` - Add attachments
- `DELETE /me/events/{id}/attachments/{id}` - Delete attachments

### User and Contact APIs
- `GET /me/people` - For attendee suggestions
- `GET /me/contacts` - Contact integration
- `GET /users` - Org directory search

## Advanced Features to Research

### Online Meeting Integration
- **Teams Graph APIs**: Research Microsoft Teams integration endpoints
- **Meeting URL Generation**: How Graph generates Teams meeting URLs  
- **Meeting Settings**: Lobby, recording, chat settings

### Timezone Handling
- `GET /outlook/supportedTimeZones` - Get supported timezones
- Timezone conversion logic
- DST handling

### Recurrence Pattern APIs
- Complex recurrence validation rules
- Exception handling for recurring events
- Recurrence pattern limitations and constraints

## Testing Methodology

### 1. Graph Explorer Testing Sequence
For each new API endpoint:

```javascript
// 1. Test basic GET
GET https://graph.microsoft.com/v1.0/me/outlook/masterCategories

// 2. Test POST with minimal data
POST https://graph.microsoft.com/v1.0/me/events
{ "subject": "Test", "start": {...}, "end": {...} }

// 3. Test POST with all new properties
POST https://graph.microsoft.com/v1.0/me/events  
{ /* Full property set */ }

// 4. Test PATCH for updates
PATCH https://graph.microsoft.com/v1.0/me/events/{id}
{ "categories": ["Updated"] }

// 5. Test error conditions
POST https://graph.microsoft.com/v1.0/me/events
{ /* Invalid data */ }
```

### 2. Permission Testing Matrix

| API Endpoint | Required Permission | Tested? |
|--------------|-------------------|---------|
| `/me/events` (read) | Calendars.Read | ✅ |
| `/me/events` (write) | Calendars.ReadWrite | ✅ |
| `/me/outlook/masterCategories` | ? | ❌ |
| `/me/places` | ? | ❌ |
| `/me/calendar/getSchedule` | ? | ❌ |

### 3. Response Schema Documentation

For each endpoint, document:
- Complete response schema
- Optional vs required fields  
- Nested object structures
- Array vs single object responses
- Error response formats

## Implementation Priority Research

### Phase 1: Core Property Enhancement
**APIs to research first:**
1. `POST /me/events` - Full parameter documentation
2. `PATCH /me/events/{id}` - Update event capabilities
3. `GET /me/outlook/masterCategories` - Category management

### Phase 2: Advanced Features  
**APIs to research next:**
1. `POST /me/calendar/getSchedule` - Room booking
2. `GET /me/places` - Resource discovery
3. Teams integration endpoints

### Phase 3: Polish and Edge Cases
**APIs to research last:**
1. Recurrence exception handling
2. Attachment management enhancement
3. Advanced reminder/notification APIs

## Documentation Deliverables

### 1. Complete API Reference
- All available endpoints with parameters
- Response schemas and examples
- Error codes and messages
- Permission requirements

### 2. Implementation Guide  
- Step-by-step implementation for each feature
- Code examples and best practices
- Testing and validation procedures
- Error handling patterns

### 3. Migration Guide
- How to update existing MCP server
- Backwards compatibility considerations  
- Testing existing functionality

## Research Tools and Resources

### Essential URLs
1. **Graph Explorer**: https://developer.microsoft.com/graph/graph-explorer
2. **API Reference**: https://learn.microsoft.com/en-us/graph/api/overview
3. **Permissions Reference**: https://learn.microsoft.com/en-us/graph/permissions-reference
4. **Azure Portal**: https://portal.azure.com
5. **Graph SDK Documentation**: https://learn.microsoft.com/en-us/graph/sdks/sdks-overview

### Testing Accounts
- Ensure access to test Microsoft 365 account
- Verify required permissions are granted
- Test with both delegated and application permissions

### Development Environment
- Node.js with Graph SDK
- Postman or similar for API testing
- Code editor with Graph schema IntelliSense
- Version control for tracking changes

## Success Criteria

Research phase complete when:
- [ ] All priority APIs tested in Graph Explorer
- [ ] Complete property matrix documented  
- [ ] Permission requirements verified
- [ ] Error handling patterns documented
- [ ] Implementation roadmap created
- [ ] Testing strategy defined

Next step: Begin systematic API testing and documentation using this checklist.
