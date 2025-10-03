/**
 * Calendar module for Outlook MCP server
 */
const handleListEvents = require('./list');
const handleDeclineEvent = require('./decline');
const handleCreateEvent = require('./create');
const handleCancelEvent = require('./cancel');
const handleDeleteEvent = require('./delete');
const handleUpdateEvent = require('./update');

// Calendar tool definitions
const calendarTools = [
  {
    name: "list-events",
    description: "Lists upcoming events from your calendar",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of events to retrieve (default: 10, max: 50)"
        }
      },
      required: []
    },
    handler: handleListEvents
  },
  {
    name: "decline-event",
    description: "Declines a calendar event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "The ID of the event to decline"
        },
        comment: {
          type: "string",
          description: "Optional comment for declining the event"
        }
      },
      required: ["eventId"]
    },
    handler: handleDeclineEvent
  },
  {
    name: "create-event",
    description: "Creates a new calendar event",
    inputSchema: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "The subject of the event"
        },
        start: {
          description: "Start date/time (ISO string or {dateTime,timeZone})"
        },
        end: {
          description: "End date/time (ISO string or {dateTime,timeZone})"
        },
        attendees: {
          type: "array",
          description: "List of attendee email addresses or attendee objects"
        },
        body: {
          type: "string",
          description: "Optional body content for the event"
        },
        showAs: {
          type: "string",
          description: "Availability status (free, workingElsewhere, tentative, busy, outOfOffice, unknown)"
        },
        categories: {
          type: "array",
          description: "Array of categories to assign"
        },
        location: {
          description: "Optional location (string or object with displayName)"
        },
        importance: {
          type: "string",
          description: "Importance level (low, normal, high)"
        },
        isAllDay: {
          type: "boolean",
          description: "Whether the event lasts all day"
        },
        isReminderOn: {
          type: "boolean",
          description: "Whether to enable reminders (default true)"
        },
        reminderMinutesBeforeStart: {
          type: "number",
          description: "Minutes before event start to trigger reminder (default 15)"
        },
        responseRequested: {
          type: "boolean",
          description: "Whether attendee responses are requested"
        },
        allowNewTimeProposals: {
          type: "boolean",
          description: "Whether attendees can propose new times"
        },
        hideAttendees: {
          type: "boolean",
          description: "Whether to hide attendee list"
        },
        isOnlineMeeting: {
          type: "boolean",
          description: "Whether to mark as an online meeting"
        }
      },
      required: ["subject", "start", "end"],
      additionalProperties: true
    },
    handler: handleCreateEvent
  },
  {
    name: "update-event",
    description: "Updates fields on an existing calendar event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "The ID of the event to update"
        },
        subject: {
          type: "string",
          description: "Updated subject for the event"
        },
        start: {
          description: "Updated start date/time (ISO string or {dateTime,timeZone})"
        },
        end: {
          description: "Updated end date/time (ISO string or {dateTime,timeZone})"
        },
        attendees: {
          type: "array",
          description: "Updated attendee list"
        },
        showAs: {
          type: "string",
          description: "Updated availability status (free, workingElsewhere, tentative, busy, outOfOffice, unknown)"
        },
        categories: {
          type: "array",
          description: "Updated categories array"
        },
        body: {
          type: "string",
          description: "Updated event body"
        },
        importance: {
          type: "string",
          description: "Updated event importance (low, normal, high)"
        },
        reminderMinutesBeforeStart: {
          type: "number",
          description: "Updated reminder offset in minutes"
        },
        location: {
          description: "Updated location (string or object with displayName)"
        },
        isAllDay: {
          type: "boolean",
          description: "Set whether the event lasts all day"
        },
        responseRequested: {
          type: "boolean",
          description: "Set whether attendee responses are requested"
        },
        allowNewTimeProposals: {
          type: "boolean",
          description: "Allow attendees to propose new times"
        },
        hideAttendees: {
          type: "boolean",
          description: "Hide attendee list from recipients"
        },
        isOnlineMeeting: {
          type: "boolean",
          description: "Toggle online meeting flag"
        },
        isReminderOn: {
          type: "boolean",
          description: "Enable or disable reminders"
        }
      },
      required: ["eventId"],
      additionalProperties: true
    },
    handler: handleUpdateEvent
  },
  {
    name: "cancel-event",
    description: "Cancels a calendar event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "The ID of the event to cancel"
        },
        comment: {
          type: "string",
          description: "Optional comment for cancelling the event"
        }
      },
      required: ["eventId"]
    },
    handler: handleCancelEvent
  },
  {
    name: "delete-event",
    description: "Deletes a calendar event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "The ID of the event to delete"
        }
      },
      required: ["eventId"]
    },
    handler: handleDeleteEvent
  }
];

module.exports = {
  calendarTools,
  handleListEvents,
  handleDeclineEvent,
  handleCreateEvent,
  handleCancelEvent,
  handleDeleteEvent,
  handleUpdateEvent
};
