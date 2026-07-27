# Microsoft Graph API Research Plan for Outlook MCP Enhancement

## Objective
Systematically gather information from Microsoft/Azure documentation to implement all missing calendar event features identified in the GUI screenshot analysis.

## Phase 1: Core Schema Research

### 1.1 Event Resource Deep Dive
- **URL**: https://learn.microsoft.com/en-us/graph/api/resources/event
- **Focus**: Complete property list with descriptions and constraints
- **Output**: Complete property mapping document

### 1.2 Create/Update Event APIs  
- **URLs**: 
  - https://learn.microsoft.com/en-us/graph/api/user-post-events
  - https://learn.microsoft.com/en-us/graph/api/event-update
- **Focus**: Required vs optional parameters, validation rules
- **Output**: Parameter validation matrix

### 1.3 Related Resource Types
Research supporting types:
- `dateTimeTimeZone` - Time handling
- `attendee` - Attendee management  
- `location` - Enhanced location objects
- `patternedRecurrence` - Recurrence patterns
- `onlineMeetingInfo` - Teams integration
- `itemBody` - Rich text formatting

## Phase 2: Live API Testing (Graph Explorer)

### 2.1 Basic Property Testing
Test each new property in Graph Explorer:
```
POST https://graph.microsoft.com/v1.0/me/events
{
  "subject": "Test Event",
  "start": {...},
  "end": {...},
  "isAllDay": false,
  "importance": "high",
  "sensitivity": "private",
  "categories": ["Work", "Important"],
  "isOnlineMeeting": true,
  "onlineMeetingProvider": "teamsForBusiness",
  "showAs": "busy",
  "reminderMinutesBeforeStart": 30
}
```

### 2.2 Complex Feature Testing
- **Recurrence Patterns**: Test daily, weekly, monthly recurrence
- **Location Objects**: Test room booking, address details
- **Online Meetings**: Test Teams vs Skype integration
- **Categories**: Test category creation and validation

### 2.3 Error Response Analysis
Document error responses for:
- Invalid enum values
- Missing required properties
- Permission failures
- Malformed nested objects

## Phase 3: Azure Portal Configuration

### 3.1 App Registration Review
- **Location**: portal.azure.com → App registrations → [Your App]
- **Check**:
  - Current scopes granted
  - Additional scopes needed for new features
  - Delegated vs application permissions

### 3.2 Permission Requirements Matrix
Document which features require which permissions:
| Feature | Required Permission | Notes |
|---------|-------------------|-------|
| Basic events | Calendars.ReadWrite | Already have |
| Online meetings | ? | Research needed |
| Room booking | ? | Research needed |
| Categories | ? | Research needed |

## Phase 4: Advanced Features Research

### 4.1 Recurrence Documentation
- **URL**: https://learn.microsoft.com/en-us/graph/api/resources/patternedrecurrence
- **Focus**: All recurrence types and their parameters
- **Output**: Recurrence pattern examples and validation rules

### 4.2 Online Meeting Integration
- **URLs**:
  - https://learn.microsoft.com/en-us/graph/api/resources/onlinemeeting
  - https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/meeting/overview
- **Focus**: Teams vs Skype configuration, URL generation
- **Output**: Online meeting setup guide

### 4.3 Room and Resource Booking
- **URL**: https://learn.microsoft.com/en-us/graph/api/calendar-getschedule
- **Focus**: Resource availability, booking conflicts
- **Output**: Room booking implementation strategy

## Phase 5: Implementation Planning

### 5.1 Validation Logic Research  
For each new property, document:
- Accepted values/ranges
- Default values
- Required vs optional
- Dependencies between properties

### 5.2 Error Handling Patterns
Research Microsoft Graph error response patterns:
- Standard error codes
- Error message formats  
- Best practices for error propagation

### 5.3 Testing Strategy
Plan comprehensive testing approach:
- Unit tests for each property
- Integration tests for complex features
- Error condition testing
- Performance impact assessment

## Deliverables

1. **Complete Property Matrix** - All event properties with implementation difficulty
2. **API Reference Guide** - Quick reference for all supported operations
3. **Implementation Roadmap** - Prioritized development plan
4. **Testing Documentation** - Test cases and validation rules
5. **Error Handling Guide** - Comprehensive error response documentation

## Research Tools to Use

1. **Microsoft Graph Explorer** - https://developer.microsoft.com/en-us/graph/graph-explorer
2. **Graph API Documentation** - https://learn.microsoft.com/en-us/graph/
3. **Azure Portal** - https://portal.azure.com
4. **Microsoft 365 Developer Portal** - https://developer.microsoft.com/en-us/microsoft-365/
5. **Graph Permissions Reference** - https://learn.microsoft.com/en-us/graph/permissions-reference

## Next Steps

1. Start with Phase 1 schema research
2. Move to live testing in Graph Explorer  
3. Document findings systematically
4. Create implementation plan based on findings
5. Begin development with highest-value, lowest-risk features
