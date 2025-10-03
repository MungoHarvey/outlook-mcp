/**
 * List events functionality
 */
const config = require('../config');
const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');

/**
 * List events handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleListEvents(args) {
  const count = Math.min(args.count || 10, config.MAX_RESULT_COUNT);
  
  try {
    // Get access token
    const accessToken = await ensureAuthenticated();
    
    // Build API endpoint
    let endpoint = 'me/events';
    
    // Add query parameters
    const queryParams = {
      $top: count,
      $orderby: 'start/dateTime',
      $filter: `start/dateTime ge '${new Date().toISOString()}'`,
      $select: config.CALENDAR_SELECT_FIELDS
    };
    
    // Make API call
    const response = await callGraphAPI(accessToken, 'GET', endpoint, null, queryParams);
    
    if (!response.value || response.value.length === 0) {
      return {
        content: [{ 
          type: "text", 
          text: "No calendar events found."
        }]
      };
    }
    
    // Format results
    const eventList = response.value.map((event, index) => {
      const location = event.location?.displayName || 'No location';
      const showAs = event.showAs || 'unknown';
      const categories = Array.isArray(event.categories) && event.categories.length > 0
        ? event.categories.join(', ')
        : 'None';

      // For all-day events or events on different days, show full date-time
      let timeDisplay;
      const startDate = new Date(event.start.dateTime);
      const endDate = new Date(event.end.dateTime);

      if (event.isAllDay || startDate.toDateString() !== endDate.toDateString()) {
        // Different days or all-day event
        timeDisplay = config.dateFormatter.formatDateRange(event.start.dateTime, event.end.dateTime, 'medium');
      } else {
        // Same day, show date once and time range
        const dateStr = config.dateFormatter.formatDate(event.start.dateTime, 'date', 'medium');
        const startTime = config.dateFormatter.formatDate(event.start.dateTime, 'time', 'short');
        const endTime = config.dateFormatter.formatDate(event.end.dateTime, 'time', 'short');
        timeDisplay = `${dateStr} ${startTime} - ${endTime}`;
      }

      // Add timezone information for clarity during DST periods
      const userTimezone = config.dateFormatter.getUserTimezone();
      const timezoneNote = userTimezone.name.includes('Europe/London') && new Date().getTimezoneOffset() !== 0
        ? ` (${userTimezone.displayName})`
        : '';

      return `${index + 1}. ${event.subject}\nStatus: ${showAs}\nCategories: ${categories}\nLocation: ${location}\nTime: ${timeDisplay}${timezoneNote}\nSummary: ${event.bodyPreview}\nID: ${event.id}\n`;
    }).join("\n");
    
    return {
      content: [{ 
        type: "text", 
        text: `Found ${response.value.length} events:\n\n${eventList}`
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
        text: `Error listing events: ${error.message}`
      }]
    };
  }
}

module.exports = handleListEvents;
