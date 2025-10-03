/**
 * Create event functionality
 */
const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');
const config = require('../config');
const {
  normalizeShowAs,
  normalizeCategories,
  normalizeDateTimeInput,
  normalizeAttendees
} = require('./event-utils');

/**
 * Create event handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleCreateEvent(args) {
  const {
    subject,
    start,
    end,
    attendees,
    body,
    showAs,
    categories,
    location,
    importance,
    isAllDay,
    isReminderOn,
    reminderMinutesBeforeStart,
    responseRequested,
    allowNewTimeProposals,
    hideAttendees,
    isOnlineMeeting
  } = args;

  if (!subject || !start || !end) {
    return {
      content: [{
        type: "text",
        text: "Subject, start, and end times are required to create an event."
      }]
    };
  }

  try {
    // Get access token
    const accessToken = await ensureAuthenticated();

    // Build API endpoint
    const endpoint = `me/events`;

    // Get user's configured timezone
    const userTimezone = config.dateFormatter.getUserTimezone().name;

    const normalizedStart = normalizeDateTimeInput(start, userTimezone, 'start');
    if (normalizedStart.error) {
      return {
        content: [{ type: "text", text: normalizedStart.error }]
      };
    }

    const normalizedEnd = normalizeDateTimeInput(end, userTimezone, 'end');
    if (normalizedEnd.error) {
      return {
        content: [{ type: "text", text: normalizedEnd.error }]
      };
    }

    const normalizedAttendees = normalizeAttendees(attendees);
    if (normalizedAttendees.error) {
      return {
        content: [{ type: "text", text: normalizedAttendees.error }]
      };
    }

    const normalizedShowAs = normalizeShowAs(showAs);
    if (normalizedShowAs.error) {
      return {
        content: [{ type: "text", text: normalizedShowAs.error }]
      };
    }

    const normalizedCategories = normalizeCategories(categories);
    if (normalizedCategories.error) {
      return {
        content: [{ type: "text", text: normalizedCategories.error }]
      };
    }

    let resolvedLocation;
    if (location !== undefined) {
      if (typeof location === 'string') {
        const trimmed = location.trim();
        if (trimmed.length === 0) {
          return {
            content: [{ type: "text", text: "If provided, 'location' must not be an empty string." }]
          };
        }
        resolvedLocation = { displayName: trimmed };
      } else if (typeof location === 'object' && location !== null) {
        const displayName = location.displayName || location.name;
        if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
          return {
            content: [{ type: "text", text: "Location objects must include a 'displayName' or 'name'." }]
          };
        }
        resolvedLocation = {
          displayName: displayName.trim(),
          locationType: location.locationType || location.type,
          uniqueId: location.uniqueId || location.email,
          address: location.address
        };
      } else {
        return {
          content: [{ type: "text", text: "If provided, 'location' must be a string or an object with display details." }]
        };
      }
    }

    let resolvedImportance;
    if (importance !== undefined) {
      if (typeof importance !== 'string' || !['low', 'normal', 'high'].includes(importance.trim().toLowerCase())) {
        return {
          content: [{
            type: "text",
            text: "Invalid 'importance' value. Use one of: low, normal, high."
          }]
        };
      }
      resolvedImportance = importance.trim().toLowerCase();
    }

    let resolvedReminder;
    if (reminderMinutesBeforeStart !== undefined) {
      const parsedReminder = Number(reminderMinutesBeforeStart);
      if (!Number.isInteger(parsedReminder) || parsedReminder < 0) {
        return {
          content: [{
            type: "text",
            text: "'reminderMinutesBeforeStart' must be a non-negative integer."
          }]
        };
      }
      resolvedReminder = parsedReminder;
    }

    // Request body
    const bodyContent = {
      subject,
      start: normalizedStart.value,
      end: normalizedEnd.value,
      body: { contentType: "HTML", content: body || "" },
      attendees: normalizedAttendees.value,
      showAs: normalizedShowAs.value,
      categories: normalizedCategories.value,
      location: resolvedLocation,
      importance: resolvedImportance,
      reminderMinutesBeforeStart: resolvedReminder,
      isReminderOn: isReminderOn !== undefined ? Boolean(isReminderOn) : undefined,
      isAllDay: isAllDay !== undefined ? Boolean(isAllDay) : undefined,
      responseRequested: responseRequested !== undefined ? Boolean(responseRequested) : undefined,
      allowNewTimeProposals: allowNewTimeProposals !== undefined ? Boolean(allowNewTimeProposals) : undefined,
      hideAttendees: hideAttendees !== undefined ? Boolean(hideAttendees) : undefined,
      isOnlineMeeting: isOnlineMeeting !== undefined ? Boolean(isOnlineMeeting) : undefined
    };

    if (!bodyContent.attendees || bodyContent.attendees.length === 0) {
      delete bodyContent.attendees;
    }

    if (!bodyContent.showAs) {
      delete bodyContent.showAs;
    }

    if (!bodyContent.categories) {
      delete bodyContent.categories;
    }

    if (!bodyContent.location) {
      delete bodyContent.location;
    }

    if (!bodyContent.importance) {
      delete bodyContent.importance;
    }

    if (bodyContent.reminderMinutesBeforeStart === undefined) {
      bodyContent.reminderMinutesBeforeStart = 15;
    }

    if (bodyContent.isReminderOn === undefined) {
      bodyContent.isReminderOn = true;
    }

    if (bodyContent.isAllDay === undefined) {
      delete bodyContent.isAllDay;
    }

    if (bodyContent.responseRequested === undefined) {
      delete bodyContent.responseRequested;
    }

    if (bodyContent.allowNewTimeProposals === undefined) {
      delete bodyContent.allowNewTimeProposals;
    }

    if (bodyContent.hideAttendees === undefined) {
      delete bodyContent.hideAttendees;
    }

    if (bodyContent.isOnlineMeeting === undefined) {
      delete bodyContent.isOnlineMeeting;
    }

    // Make API call
    const response = await callGraphAPI(accessToken, 'POST', endpoint, bodyContent);

    return {
      content: [{
        type: "text",
        text: `Event '${subject}' has been successfully created.`
      }]
    };
  } catch (error) {
    if (error.message === 'Authentication required') {
      return {
        content: [{
          type: "text",
          text: "Authentication required. Please use the 'authenticate' tool first."
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Error creating event: ${error.message}`
      }]
    };
  }
}

module.exports = handleCreateEvent;