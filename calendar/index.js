/**
 * Calendar module for Outlook MCP server
 */
const handleListEvents = require('./list');
const handleDeclineEvent = require('./decline');
const handleCreateEvent = require('./create');
const handleCancelEvent = require('./cancel');
const handleDeleteEvent = require('./delete');
const handleUpdateEvent = require('./update');

// Runtime validation using AJV for robust, draft-07-compatible checks
let Ajv;
let addFormats;
try {
  Ajv = require('ajv');
  addFormats = require('ajv-formats');
} catch (_) {
  // AJV may not be installed yet; handlers will still work thanks to in-handler validation
}
// Config for feature flags
let config;
try {
  config = require('../config');
} catch (_) {
  config = {};
}

function withValidation(inputSchema, handler) {
  if (!Ajv) {
    return handler;
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  if (addFormats) addFormats(ajv);
  const validate = ajv.compile(inputSchema);
  return async (args = {}) => {
    const valid = validate(args);
    if (!valid) {
      const message = `Validation failed: ${validate.errors.map(e => `${e.instancePath || e.schemaPath} ${e.message}`).join('; ')}`;
      return { content: [{ type: 'text', text: message }] };
    }
    return handler(args);
  };
}

// Shared JSON Schemas used by multiple consumers (server and tests)
const createEventSchema = {
  type: "object",
  properties: {
    subject: { type: "string", description: "The subject of the event" },
    start: {
      description: "Start date/time (ISO string or {dateTime,timeZone})",
      oneOf: [
        { type: "string", format: "date-time" },
        {
          type: "object",
          properties: { dateTime: { type: "string" }, timeZone: { type: "string" } },
          required: ["dateTime"],
          additionalProperties: true
        }
      ]
    },
    end: {
      description: "End date/time (ISO string or {dateTime,timeZone})",
      oneOf: [
        { type: "string", format: "date-time" },
        {
          type: "object",
          properties: { dateTime: { type: "string" }, timeZone: { type: "string" } },
          required: ["dateTime"],
          additionalProperties: true
        }
      ]
    },
    attendees: { 
      type: "array", 
      description: "List of attendee email addresses or objects", 
      items: { 
        oneOf: [
          { type: "string", format: "email" },
          { 
            type: "object", 
            properties: { 
              email: { type: "string", format: "email" },
              type: { type: "string", enum: ["required", "optional", "resource"] }
            },
            required: ["email"]
          }
        ]
      } 
    },
    body: { type: "string", description: "Optional body content for the event" },
    showAs: { type: "string", description: "Availability status (free, workingElsewhere, tentative, busy, outOfOffice, unknown)" },
    categories: { type: "array", description: "Array of categories to assign", items: { type: "string" } },
    location: {
      description: "Optional location (string or object with displayName)",
      oneOf: [ { type: "string" }, { type: "object", properties: { displayName: { type: "string" } }, required: ["displayName"], additionalProperties: true } ]
    },
    importance: { type: "string", description: "Importance level (low, normal, high)" },
    sensitivity: { type: "string", description: "Sensitivity level (normal, personal, private, confidential)", enum: ["normal", "personal", "private", "confidential"] },
    recurrence: {
      type: "object",
      description: "Optional recurrence pattern",
      properties: {
        pattern: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["daily", "weekly", "absoluteMonthly", "relativeMonthly", "absoluteYearly", "relativeYearly"] },
            interval: { type: "integer" },
            daysOfWeek: { type: "array", items: { type: "string" } },
            dayOfMonth: { type: "integer" },
            month: { type: "integer" },
            index: { type: "string", enum: ["first", "second", "third", "fourth", "last"] }
          },
          required: ["type", "interval"]
        },
        range: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["endDate", "noEnd", "numbered"] },
            startDate: { type: "string" },
            endDate: { type: "string" },
            numberOfOccurrences: { type: "integer" },
            recurrenceTimeZone: { type: "string" }
          },
          required: ["type", "startDate"]
        }
      },
      required: ["pattern", "range"]
    },
    isAllDay: { type: "boolean", description: "Whether the event lasts all day" },
    isReminderOn: { type: "boolean", description: "Whether to enable reminders (default true)" },
    reminderMinutesBeforeStart: { type: "number", description: "Minutes before event start to trigger reminder (default 15)" },
    responseRequested: { type: "boolean", description: "Whether attendee responses are requested" },
    allowNewTimeProposals: { type: "boolean", description: "Whether attendees can propose new times" },
    hideAttendees: { type: "boolean", description: "Whether to hide attendee list" },
    isOnlineMeeting: { type: "boolean", description: "Whether to mark as an online meeting" },
    onlineMeetingProvider: { type: "string", description: "Online meeting provider (e.g., teamsForBusiness)", enum: ["unknown", "skypeForConsumer", "skypeForBusiness", "teamsForBusiness"] }
  },
  required: ["subject", "start", "end"],
  additionalProperties: true
};

const updateEventSchema = {
  type: "object",
  properties: {
    eventId: { type: "string", description: "The ID of the event to update" },
    subject: { type: "string", description: "Updated subject for the event" },
    start: {
      description: "Updated start date/time (ISO string or {dateTime,timeZone})",
      oneOf: [ { type: "string", format: "date-time" }, { type: "object", properties: { dateTime: { type: "string" }, timeZone: { type: "string" } }, required: ["dateTime"], additionalProperties: true } ]
    },
    end: {
      description: "Updated end date/time (ISO string or {dateTime,timeZone})",
      oneOf: [ { type: "string", format: "date-time" }, { type: "object", properties: { dateTime: { type: "string" }, timeZone: { type: "string" } }, required: ["dateTime"], additionalProperties: true } ]
    },
    attendees: { 
      type: "array", 
      description: "Updated attendee email addresses or objects", 
      items: { 
        oneOf: [
          { type: "string", format: "email" },
          { 
            type: "object", 
            properties: { 
              email: { type: "string", format: "email" },
              type: { type: "string", enum: ["required", "optional", "resource"] }
            },
            required: ["email"]
          }
        ]
      } 
    },
    showAs: { type: "string", description: "Updated availability status (free, workingElsewhere, tentative, busy, outOfOffice, unknown)" },
    categories: { type: "array", description: "Updated categories array", items: { type: "string" } },
    body: { type: "string", description: "Updated event body" },
    importance: { type: "string", description: "Updated event importance (low, normal, high)" },
    sensitivity: { type: "string", description: "Updated sensitivity level (normal, personal, private, confidential)", enum: ["normal", "personal", "private", "confidential"] },
    recurrence: {
      type: "object",
      description: "Updated recurrence pattern",
      properties: {
        pattern: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["daily", "weekly", "absoluteMonthly", "relativeMonthly", "absoluteYearly", "relativeYearly"] },
            interval: { type: "integer" },
            daysOfWeek: { type: "array", items: { type: "string" } },
            dayOfMonth: { type: "integer" },
            month: { type: "integer" },
            index: { type: "string", enum: ["first", "second", "third", "fourth", "last"] }
          },
          required: ["type", "interval"]
        },
        range: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["endDate", "noEnd", "numbered"] },
            startDate: { type: "string" },
            endDate: { type: "string" },
            numberOfOccurrences: { type: "integer" },
            recurrenceTimeZone: { type: "string" }
          },
          required: ["type", "startDate"]
        }
      },
      required: ["pattern", "range"]
    },
    reminderMinutesBeforeStart: { type: "number", description: "Updated reminder offset in minutes" },
    location: {
      description: "Updated location (string or object with displayName)",
      oneOf: [ { type: "string" }, { type: "object", properties: { displayName: { type: "string" } }, required: ["displayName"], additionalProperties: true } ]
    },
    isAllDay: { type: "boolean", description: "Set whether the event lasts all day" },
    responseRequested: { type: "boolean", description: "Set whether attendee responses are requested" },
    allowNewTimeProposals: { type: "boolean", description: "Allow attendees to propose new times" },
    hideAttendees: { type: "boolean", description: "Hide attendee list from recipients" },
    isOnlineMeeting: { type: "boolean", description: "Toggle online meeting flag" },
    onlineMeetingProvider: { type: "string", description: "Updated online meeting provider", enum: ["unknown", "skypeForConsumer", "skypeForBusiness", "teamsForBusiness"] },
    isReminderOn: { type: "boolean", description: "Enable or disable reminders" }
  },
  required: ["eventId"],
  additionalProperties: true
};

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
  { name: "create-event", description: "Creates a new calendar event", inputSchema: createEventSchema, handler: withValidation(createEventSchema, handleCreateEvent) },
  { name: "update-event", description: "Updates fields on an existing calendar event", inputSchema: updateEventSchema, handler: withValidation(updateEventSchema, handleUpdateEvent) },
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

const finalCalendarTools = config && config.DISABLE_CREATE_EVENT
  ? calendarTools.filter(t => t.name !== 'create-event')
  : calendarTools;

module.exports = {
  calendarTools: finalCalendarTools,
  handleListEvents,
  handleDeclineEvent,
  handleCreateEvent,
  handleCancelEvent,
  handleDeleteEvent,
  handleUpdateEvent
};
