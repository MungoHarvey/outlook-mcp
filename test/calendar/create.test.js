const handleCreateEvent = require('../../calendar/create');
const config = require('../../config');
const { callGraphAPI } = require('../../utils/graph-api');
const { ensureAuthenticated } = require('../../auth');

jest.mock('../../utils/graph-api');
jest.mock('../../auth');
jest.mock('../../config', () => ({
  dateFormatter: {
    getUserTimezone: jest.fn()
  }
}));

const DEFAULT_TIMEZONE = 'UTC';

describe('handleCreateEvent', () => {
  beforeEach(() => {
    // Reset mocks before each test
    callGraphAPI.mockClear();
    ensureAuthenticated.mockClear();
    config.dateFormatter.getUserTimezone.mockReturnValue({ name: DEFAULT_TIMEZONE });
  });

  test('should use default timezone when no timezone is provided', async () => {
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
    callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

    const args = {
      subject: 'Test Event',
      start: '2024-03-10T10:00:00',
      end: '2024-03-10T11:00:00',
    };

    await handleCreateEvent(args);

    expect(ensureAuthenticated).toHaveBeenCalledTimes(1);
    expect(callGraphAPI).toHaveBeenCalledTimes(1);
    const callGraphAPIArgs = callGraphAPI.mock.calls[0][3]; // bodyContent is the 4th argument
    expect(callGraphAPIArgs.start.timeZone).toBe(DEFAULT_TIMEZONE);
    expect(callGraphAPIArgs.end.timeZone).toBe(DEFAULT_TIMEZONE);
  });

  test('should use specified timezone when provided', async () => {
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
    callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

    const specifiedTimeZone = 'Pacific Standard Time';
    const args = {
      subject: 'Test Event with Specific Timezone',
      start: { dateTime: '2024-03-10T10:00:00', timeZone: specifiedTimeZone },
      end: { dateTime: '2024-03-10T11:00:00', timeZone: specifiedTimeZone },
    };

    await handleCreateEvent(args);

    expect(ensureAuthenticated).toHaveBeenCalledTimes(1);
    expect(callGraphAPI).toHaveBeenCalledTimes(1);
    const callGraphAPIArgs = callGraphAPI.mock.calls[0][3]; // bodyContent is the 4th argument
    expect(callGraphAPIArgs.start.timeZone).toBe(specifiedTimeZone);
    expect(callGraphAPIArgs.end.timeZone).toBe(specifiedTimeZone);
  });

  test('should use default timezone if only start timezone is provided', async () => {
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
    callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

    const specifiedTimeZone = 'Pacific Standard Time';
    const args = {
        subject: 'Test Event with Specific Start Timezone',
        start: { dateTime: '2024-03-10T10:00:00', timeZone: specifiedTimeZone },
        end: { dateTime: '2024-03-10T11:00:00' }, // No timezone for end
    };

    await handleCreateEvent(args);

    expect(ensureAuthenticated).toHaveBeenCalledTimes(1);
    expect(callGraphAPI).toHaveBeenCalledTimes(1);
    const callGraphAPIArgs = callGraphAPI.mock.calls[0][3];
    expect(callGraphAPIArgs.start.timeZone).toBe(specifiedTimeZone);
    expect(callGraphAPIArgs.end.timeZone).toBe(DEFAULT_TIMEZONE);
  });

  test('should use default timezone if only end timezone is provided', async () => {
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
    callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

    const specifiedTimeZone = 'Pacific Standard Time';
    const args = {
        subject: 'Test Event with Specific End Timezone',
        start: { dateTime: '2024-03-10T10:00:00' }, // No timezone for start
        end: { dateTime: '2024-03-10T11:00:00', timeZone: specifiedTimeZone },
    };

    await handleCreateEvent(args);

    expect(ensureAuthenticated).toHaveBeenCalledTimes(1);
    expect(callGraphAPI).toHaveBeenCalledTimes(1);
    const callGraphAPIArgs = callGraphAPI.mock.calls[0][3];
    expect(callGraphAPIArgs.start.timeZone).toBe(DEFAULT_TIMEZONE);
    expect(callGraphAPIArgs.end.timeZone).toBe(specifiedTimeZone);
  });

  test('should return error if subject is missing', async () => {
    const args = {
      start: '2024-03-10T10:00:00',
      end: '2024-03-10T11:00:00',
    };

    const result = await handleCreateEvent(args);
    expect(result.content[0].text).toBe("Subject, start, and end times are required to create an event.");
    expect(ensureAuthenticated).not.toHaveBeenCalled();
    expect(callGraphAPI).not.toHaveBeenCalled();
  });

  test('should return error if start is missing', async () => {
    const args = {
      subject: 'Test Event',
      end: '2024-03-10T11:00:00',
    };

    const result = await handleCreateEvent(args);
    expect(result.content[0].text).toBe("Subject, start, and end times are required to create an event.");
    expect(ensureAuthenticated).not.toHaveBeenCalled();
    expect(callGraphAPI).not.toHaveBeenCalled();
  });

  test('should return error if end is missing', async () => {
    const args = {
      subject: 'Test Event',
      start: '2024-03-10T10:00:00',
    };

    const result = await handleCreateEvent(args);
    expect(result.content[0].text).toBe("Subject, start, and end times are required to create an event.");
    expect(ensureAuthenticated).not.toHaveBeenCalled();
    expect(callGraphAPI).not.toHaveBeenCalled();
  });

   test('should handle authentication error', async () => {
    ensureAuthenticated.mockRejectedValue(new Error('Authentication required'));
    const args = {
      subject: 'Test Event',
      start: '2024-03-10T10:00:00',
      end: '2024-03-10T11:00:00',
    };

    const result = await handleCreateEvent(args);
    expect(result.content[0].text).toBe("Authentication required. Please use the 'authenticate' tool first.");
    expect(callGraphAPI).not.toHaveBeenCalled();
  });

  test('should handle Graph API call error', async () => {
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
    callGraphAPI.mockRejectedValue(new Error('Graph API Error'));
     const args = {
      subject: 'Test Event',
      start: '2024-03-10T10:00:00',
      end: '2024-03-10T11:00:00',
    };

    const result = await handleCreateEvent(args);
    expect(result.content[0].text).toBe("Error creating event: Graph API Error");
  });

  test('should handle sensitivity and recurrence', async () => {
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
    callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

    const args = {
      subject: 'Recurring Private Event',
      start: '2024-03-10T10:00:00',
      end: '2024-03-10T11:00:00',
      sensitivity: 'private',
      recurrence: {
        pattern: { type: 'daily', interval: 1 },
        range: { type: 'noEnd', startDate: '2024-03-10' }
      }
    };

    await handleCreateEvent(args);

    expect(callGraphAPI).toHaveBeenCalledTimes(1);
    const body = callGraphAPI.mock.calls[0][3];
    expect(body.sensitivity).toBe('private');
    expect(body.recurrence).toEqual(args.recurrence);
  });

  test('should handle complex attendees', async () => {
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
    callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

    const args = {
      subject: 'Meeting with Optional Attendee',
      start: '2024-03-10T10:00:00',
      end: '2024-03-10T11:00:00',
      attendees: [
        'required@example.com',
        { email: 'optional@example.com', type: 'optional' }
      ]
    };

    await handleCreateEvent(args);

    expect(callGraphAPI).toHaveBeenCalledTimes(1);
    const body = callGraphAPI.mock.calls[0][3];
    expect(body.attendees).toHaveLength(2);
    expect(body.attendees[0]).toEqual({ emailAddress: { address: 'required@example.com' }, type: 'required' });
    expect(body.attendees[1]).toEqual({ emailAddress: { address: 'optional@example.com' }, type: 'optional' });
  });

  test('should handle online meeting provider', async () => {
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
    callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

    const args = {
      subject: 'Teams Meeting',
      start: '2024-03-10T10:00:00',
      end: '2024-03-10T11:00:00',
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness'
    };

    await handleCreateEvent(args);

    expect(callGraphAPI).toHaveBeenCalledTimes(1);
    const body = callGraphAPI.mock.calls[0][3];
    expect(body.isOnlineMeeting).toBe(true);
    expect(body.onlineMeetingProvider).toBe('teamsForBusiness');
  });

});
