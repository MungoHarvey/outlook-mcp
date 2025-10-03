const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');
const config = require('../config');
const {
  normalizeShowAs,
  normalizeCategories,
  normalizeDateTimeInput,
  normalizeAttendees
} = require('./event-utils');

async function handleUpdateEvent(args) {
  const { eventId } = args;
  if (!eventId || typeof eventId !== 'string' || eventId.trim() === '') {
    return {
      content: [{
        type: 'text',
        text: "The 'eventId' parameter is required to update an event."
      }]
    };
  }

  const updates = {};
  const userTimezone = config.dateFormatter.getUserTimezone().name;

  if (args.start !== undefined) {
    const normalizedStart = normalizeDateTimeInput(args.start, userTimezone, 'start');
    if (normalizedStart.error) {
      return { content: [{ type: 'text', text: normalizedStart.error }] };
    }
    updates.start = normalizedStart.value;
  }

  if (args.end !== undefined) {
    const normalizedEnd = normalizeDateTimeInput(args.end, userTimezone, 'end');
    if (normalizedEnd.error) {
      return { content: [{ type: 'text', text: normalizedEnd.error }] };
    }
    updates.end = normalizedEnd.value;
  }

  if (args.attendees !== undefined) {
    const normalizedAttendees = normalizeAttendees(args.attendees);
    if (normalizedAttendees.error) {
      return { content: [{ type: 'text', text: normalizedAttendees.error }] };
    }
    updates.attendees = normalizedAttendees.value;
  }

  if (args.showAs !== undefined) {
    const normalizedShowAs = normalizeShowAs(args.showAs);
    if (normalizedShowAs.error) {
      return { content: [{ type: 'text', text: normalizedShowAs.error }] };
    }
    updates.showAs = normalizedShowAs.value;
  }

  if (args.categories !== undefined) {
    const normalizedCategories = normalizeCategories(args.categories, { allowEmpty: true });
    if (normalizedCategories.error) {
      return { content: [{ type: 'text', text: normalizedCategories.error }] };
    }
    updates.categories = normalizedCategories.value;
  }

  if (args.subject !== undefined) {
    if (typeof args.subject !== 'string' || args.subject.trim() === '') {
      return {
        content: [{ type: 'text', text: "If provided, 'subject' must be a non-empty string." }]
      };
    }
    updates.subject = args.subject.trim();
  }

  if (args.body !== undefined) {
    if (typeof args.body !== 'string') {
      return {
        content: [{ type: 'text', text: "If provided, 'body' must be a string." }]
      };
    }
    updates.body = { contentType: 'HTML', content: args.body };
  }

  if (args.location !== undefined) {
    if (typeof args.location === 'string') {
      const trimmed = args.location.trim();
      if (trimmed.length === 0) {
        return {
          content: [{
            type: 'text',
            text: "If provided, 'location' must not be an empty string."
          }]
        };
      }
      updates.location = { displayName: trimmed };
    } else if (typeof args.location === 'object' && args.location !== null) {
      const displayName = args.location.displayName || args.location.name;
      if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
        return {
          content: [{
            type: 'text',
            text: "Location objects must include a 'displayName' or 'name'."
          }]
        };
      }
      updates.location = {
        displayName: displayName.trim(),
        locationType: args.location.locationType || args.location.type,
        uniqueId: args.location.uniqueId || args.location.email,
        address: args.location.address
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: "If provided, 'location' must be a string or an object with display details."
        }]
      };
    }
  }

  const simpleBooleanFields = [
    'isAllDay',
    'responseRequested',
    'allowNewTimeProposals',
    'hideAttendees',
    'isOnlineMeeting',
    'isReminderOn'
  ];

  for (const field of simpleBooleanFields) {
    if (args[field] !== undefined) {
      updates[field] = Boolean(args[field]);
    }
  }

  if (args.importance !== undefined) {
    const importance = typeof args.importance === 'string' ? args.importance.trim().toLowerCase() : '';
    if (!['low', 'normal', 'high'].includes(importance)) {
      return {
        content: [{
          type: 'text',
          text: "Invalid 'importance' value. Use one of: low, normal, high."
        }]
      };
    }
    updates.importance = importance;
  }

  if (args.reminderMinutesBeforeStart !== undefined) {
    const reminder = Number(args.reminderMinutesBeforeStart);
    if (!Number.isInteger(reminder) || reminder < 0) {
      return {
        content: [{
          type: 'text',
          text: "'reminderMinutesBeforeStart' must be a non-negative integer."
        }]
      };
    }
    updates.reminderMinutesBeforeStart = reminder;
  }

  const updateFieldCount = Object.keys(updates).length;
  if (updateFieldCount === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No update fields provided. Supply at least one field to modify.'
      }]
    };
  }

  try {
    const accessToken = await ensureAuthenticated();
    const endpoint = `me/events/${eventId}`;
    await callGraphAPI(accessToken, 'PATCH', endpoint, updates);

    return {
      content: [{
        type: 'text',
        text: `Event '${eventId}' has been updated.`
      }]
    };
  } catch (error) {
    if (error.message === 'Authentication required') {
      return {
        content: [{
          type: 'text',
          text: "Authentication required. Please use the 'authenticate' tool first."
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: `Error updating event: ${error.message}`
      }]
    };
  }
}

module.exports = handleUpdateEvent;

