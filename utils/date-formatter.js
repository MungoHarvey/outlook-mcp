/**
 * Date formatting utility for Outlook MCP server
 *
 * Provides centralized date and time formatting with user-configurable
 * timezone and format preferences using a two-file configuration system.
 */

const fs = require('fs');
const path = require('path');

// Minimal fallback configuration (used only if all config files are missing)
const FALLBACK_CONFIG = {
  timezone: {
    name: 'Europe/London',
    displayName: 'GMT+1 (London)'
  },
  dateFormats: {
    date: {
      short: { year: 'numeric', month: '2-digit', day: '2-digit' },
      medium: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' },
      long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    },
    time: {
      short: { hour: '2-digit', minute: '2-digit' },
      long: { hour: '2-digit', minute: '2-digit', second: '2-digit' }
    },
    datetime: {
      short: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
      medium: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
      long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }
    }
  },
  locale: 'en-GB',
  userPreferences: {
    location: 'uk',
    dateStyle: 'medium',
    timeStyle: 'short',
    datetimeStyle: 'medium'
  }
};

// Cache for loaded configs
let userPreferences = null;
let locationFormats = null;

/**
 * Load user preferences from file
 * @returns {object} User preferences or defaults
 */
function loadUserPreferences() {
  if (userPreferences) return userPreferences;

  const configDir = path.dirname(require.main.filename);
  const preferencesPath = path.join(configDir, 'user-configs', 'user-preferences.json');

  try {
    if (fs.existsSync(preferencesPath)) {
      const fileContent = fs.readFileSync(preferencesPath, 'utf8');
      userPreferences = JSON.parse(fileContent);
      console.error(`✅ Loaded user preferences from user-configs/user-preferences.json`);
      return userPreferences;
    }
  } catch (error) {
    console.error(`❌ Error loading user preferences:`, error.message);
  }

  // No preferences found, use defaults
  console.error('ℹ️ No user preferences found, using defaults');
  userPreferences = {
    location: 'uk',
    dateStyle: 'medium',
    timeStyle: 'short',
    datetimeStyle: 'medium',
    timezoneOffset: 'auto'
  };
  return userPreferences;
}

/**
 * Load location formats from file
 * @returns {object} Location formats or defaults
 */
function loadLocationFormats() {
  if (locationFormats) return locationFormats;

  const configDir = path.dirname(require.main.filename);
  const formatsPath = path.join(configDir, 'user-configs', 'location-formats.json');

  try {
    if (fs.existsSync(formatsPath)) {
      const fileContent = fs.readFileSync(formatsPath, 'utf8');
      locationFormats = JSON.parse(fileContent);
      console.error(`✅ Loaded location formats from user-configs/location-formats.json`);
      return locationFormats;
    }
  } catch (error) {
    console.error(`❌ Error loading location formats:`, error.message);
  }

  // No formats found, return empty object
  console.error('ℹ️ No location formats found');
  locationFormats = {};
  return locationFormats;
}

/**
 * Load complete user configuration by combining preferences and formats
 * @returns {object} Complete configuration or defaults
 */
function loadUserConfig() {
  const preferences = loadUserPreferences();
  const formats = loadLocationFormats();

  // Get the selected location configuration
  const locationConfig = formats[preferences.location];

  if (locationConfig) {
    return {
      timezone: {
        name: locationConfig.timezone,
        displayName: locationConfig.name
      },
      dateFormats: locationConfig.formats,
      locale: locationConfig.locale,
      userPreferences: preferences
    };
  }

  // Location not found, use fallback
  console.error(`⚠️ Location '${preferences.location}' not found in location-formats.json, using fallback`);
  return FALLBACK_CONFIG;
}


/**
 * Check if DST is currently in effect for a given timezone
 * @param {string} timezone - IANA timezone identifier
 * @param {Date} date - Date to check (defaults to now)
 * @returns {boolean} True if DST is in effect
 */
function isDST(timezone, date = new Date()) {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const offset = (localDate - utcDate) / (1000 * 60); // offset in minutes

    // For UK/Europe, DST is when offset is 60 minutes (BST) vs 0 minutes (GMT)
    return Math.abs(offset) > 30; // More than 30 minutes difference indicates DST
  } catch (error) {
    console.error('DST check error:', error.message);
    return false;
  }
}

/**
 * Format a date using user configuration
 * @param {Date|string} date - Date to format
 * @param {string} type - Format type ('date', 'time', 'datetime')
 * @param {string} style - Format style ('short', 'medium', 'long') - if not provided, uses user's preference
 * @returns {string} Formatted date string
 */
function formatDate(date, type = 'datetime', style = null) {
  const config = loadUserConfig();
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  // Use predefined format from config
  const formatType = config.dateFormats[type];
  if (!formatType) {
    throw new Error(`Unknown format type: ${type}`);
  }

  // If no style provided, use user's preferred style
  if (!style) {
    const preferences = config.userPreferences;
    switch (type) {
      case 'date':
        style = preferences.dateStyle;
        break;
      case 'time':
        style = preferences.timeStyle;
        break;
      case 'datetime':
        style = preferences.datetimeStyle;
        break;
      default:
        style = 'medium';
    }
  }

  const options = formatType[style];
  if (!options) {
    throw new Error(`Unknown format style: ${style}`);
  }

  try {
    const formatter = new Intl.DateTimeFormat(config.locale, {
      ...options,
      timeZone: config.timezone.name
    });

    let formatted = formatter.format(dateObj);

    // Add DST indicator for UK timezone when DST is in effect
    if (config.timezone.name === 'Europe/London' && type === 'datetime' && isDST(config.timezone.name, dateObj)) {
      formatted += ' (BST)';
    }

    return formatted;
  } catch (error) {
    console.error('Date formatting error:', error.message);
    // Fallback to basic formatting
    return dateObj.toLocaleString(config.locale, { timeZone: config.timezone.name });
  }
}

/**
 * Format a date range (start and end times)
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @param {string} style - Format style ('short', 'medium', 'long') - if not provided, uses user's preference
 * @returns {string} Formatted date range
 */
function formatDateRange(startDate, endDate, style = null) {
  const config = loadUserConfig();
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid Date Range';
  }

  // Use user's preferred datetime style if none specified
  if (!style) {
    style = config.userPreferences.datetimeStyle;
  }

  const options = config.dateFormats.datetime[style];

  try {
    const formatter = new Intl.DateTimeFormat(config.locale, {
      ...options,
      timeZone: config.timezone.name
    });

    const startStr = formatter.format(start);
    const endStr = formatter.format(end);

    // Add DST indicator for UK timezone
    let dstIndicator = '';
    if (config.timezone.name === 'Europe/London' && (isDST(config.timezone.name, start) || isDST(config.timezone.name, end))) {
      dstIndicator = ' (BST)';
    }

    // If same date, show date once
    if (start.toDateString() === end.toDateString()) {
      const dateFormatter = new Intl.DateTimeFormat(config.locale, {
        ...config.dateFormats.date[config.userPreferences.dateStyle],
        timeZone: config.timezone.name
      });

      const timeFormatter = new Intl.DateTimeFormat(config.locale, {
        ...config.dateFormats.time[config.userPreferences.timeStyle],
        timeZone: config.timezone.name
      });

      return `${dateFormatter.format(start)} ${timeFormatter.format(start)} - ${timeFormatter.format(end)}${dstIndicator}`;
    }

    return `${startStr} - ${endStr}${dstIndicator}`;
  } catch (error) {
    console.error('Date range formatting error:', error.message);
    // Fallback to basic formatting
    return `${start.toLocaleString(config.locale, { timeZone: config.timezone.name })} - ${end.toLocaleString(config.locale, { timeZone: config.timezone.name })}`;
  }
}

/**
 * Get user's timezone information
 * @returns {object} Timezone info
 */
function getUserTimezone() {
  const config = loadUserConfig();
  return config.timezone;
}

/**
 * Get user's locale
 * @returns {string} Locale string
 */
function getUserLocale() {
  const config = loadUserConfig();
  return config.locale;
}

module.exports = {
  formatDate,
  formatDateRange,
  getUserTimezone,
  getUserLocale,
  loadUserConfig,
  isDST
};
