const SHOW_AS_LOOKUP = {
  free: 'free',
  tentative: 'tentative',
  busy: 'busy',
  oof: 'oof',
  outofoffice: 'oof',
  'out-of-office': 'oof',
  workingelsewhere: 'workingElsewhere',
  'working-elsewhere': 'workingElsewhere',
  unknown: 'unknown'
};

function normalizeShowAs(showAs) {
  if (showAs === undefined) {
    return { value: undefined };
  }

  if (typeof showAs !== 'string' || showAs.trim() === '') {
    return { error: "If provided, 'showAs' must be a non-empty string." };
  }

  const normalizedKey = showAs
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '-');

  const resolved = SHOW_AS_LOOKUP[normalizedKey];
  if (!resolved) {
    return {
      error: "Invalid 'showAs' value. Use one of: free, workingElsewhere, tentative, busy, outOfOffice, unknown."
    };
  }

  return { value: resolved };
}

function normalizeCategories(categories, { allowEmpty = false } = {}) {
  if (categories === undefined) {
    return { value: undefined };
  }

  if (!Array.isArray(categories)) {
    return { error: "If provided, 'categories' must be an array of strings." };
  }

  const normalized = categories
    .map(category => (typeof category === 'string' ? category.trim() : ''))
    .filter(category => category.length > 0);

  if (normalized.length === 0) {
    return { value: allowEmpty ? [] : undefined };
  }

  return { value: normalized };
}

function normalizeDateTimeInput(input, fallbackTimeZone, fieldName) {
  if (input === undefined) {
    return { value: undefined };
  }

  if (typeof input === 'string') {
    if (input.trim() === '') {
      return { error: `${fieldName} must be a valid ISO 8601 string or an object with dateTime/timeZone.` };
    }

    return {
      value: {
        dateTime: input,
        timeZone: fallbackTimeZone
      }
    };
  }

  if (typeof input === 'object' && input !== null) {
    if (!input.dateTime || typeof input.dateTime !== 'string' || input.dateTime.trim() === '') {
      return { error: `${fieldName} object must include a non-empty 'dateTime' property.` };
    }

    return {
      value: {
        dateTime: input.dateTime,
        timeZone: input.timeZone && input.timeZone.trim() !== '' ? input.timeZone : fallbackTimeZone
      }
    };
  }

  return { error: `${fieldName} must be a valid ISO 8601 string or an object with dateTime/timeZone.` };
}

function normalizeAttendees(attendees) {
  if (attendees === undefined) {
    return { value: undefined };
  }

  if (!Array.isArray(attendees)) {
    return { error: "If provided, 'attendees' must be an array of email strings or attendee objects." };
  }

  const normalized = [];
  for (const attendee of attendees) {
    if (typeof attendee === 'string') {
      const trimmed = attendee.trim();
      if (trimmed.length > 0) {
        normalized.push({ emailAddress: { address: trimmed }, type: 'required' });
      }
    } else if (attendee && typeof attendee === 'object' && attendee.emailAddress?.address) {
      normalized.push({
        emailAddress: { address: attendee.emailAddress.address },
        type: attendee.type || 'required'
      });
    } else {
      return {
        error: "Attendees must be email strings or objects with an 'emailAddress.address' value."
      };
    }
  }

  return { value: normalized };
}

module.exports = {
  SHOW_AS_LOOKUP,
  normalizeShowAs,
  normalizeCategories,
  normalizeDateTimeInput,
  normalizeAttendees
};


