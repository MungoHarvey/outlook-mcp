const handleCreateEvent = require('../../calendar/create');
const handleUpdateEvent = require('../../calendar/update');
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

describe('Calendar Features - Parity with Outlook', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    config.dateFormatter.getUserTimezone.mockReturnValue({ name: DEFAULT_TIMEZONE });
    ensureAuthenticated.mockResolvedValue('dummy_access_token');
  });

  describe('handleCreateEvent - New Features', () => {
    test('should handle optional attendees', async () => {
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
      expect(body.attendees).toEqual([
        { emailAddress: { address: 'required@example.com' }, type: 'required' },
        { emailAddress: { address: 'optional@example.com' }, type: 'optional' }
      ]);
    });

    test('should handle sensitivity', async () => {
      callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

      const args = {
        subject: 'Private Meeting',
        start: '2024-03-10T10:00:00',
        end: '2024-03-10T11:00:00',
        sensitivity: 'private'
      };

      await handleCreateEvent(args);

      expect(callGraphAPI).toHaveBeenCalledTimes(1);
      const body = callGraphAPI.mock.calls[0][3];
      expect(body.sensitivity).toBe('private');
    });

    test('should handle recurrence', async () => {
      callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

      const recurrence = {
        pattern: { type: 'daily', interval: 1 },
        range: { type: 'numbered', startDate: '2024-03-10', numberOfOccurrences: 5 }
      };

      const args = {
        subject: 'Daily Standup',
        start: '2024-03-10T10:00:00',
        end: '2024-03-10T10:30:00',
        recurrence
      };

      await handleCreateEvent(args);

      expect(callGraphAPI).toHaveBeenCalledTimes(1);
      const body = callGraphAPI.mock.calls[0][3];
      expect(body.recurrence).toEqual(recurrence);
    });

    test('should handle onlineMeetingProvider', async () => {
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

  describe('handleUpdateEvent - New Features', () => {
    test('should update sensitivity and recurrence', async () => {
      callGraphAPI.mockResolvedValue({ id: 'test_event_id' });

      const recurrence = {
        pattern: { type: 'weekly', interval: 1, daysOfWeek: ['monday'] },
        range: { type: 'noEnd', startDate: '2024-03-11' }
      };

      const args = {
        eventId: 'existing_id',
        sensitivity: 'confidential',
        recurrence
      };

      await handleUpdateEvent(args);

      expect(callGraphAPI).toHaveBeenCalledTimes(1);
      const body = callGraphAPI.mock.calls[0][3];
      expect(body.sensitivity).toBe('confidential');
      expect(body.recurrence).toEqual(recurrence);
    });
  });
});
