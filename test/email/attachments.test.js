const handleReadEmail = require('../../email/read');
const handleSendEmail = require('../../email/send');
const { callGraphAPI } = require('../../utils/graph-api');
const { ensureAuthenticated } = require('../../auth');
const config = require('../../config');

jest.mock('../../utils/graph-api');
jest.mock('../../auth');
jest.mock('../../config', () => ({
  EMAIL_DETAIL_FIELDS: 'id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,body,importance,hasAttachments',
  dateFormatter: {
    formatDate: jest.fn((d) => d)
  }
}));

describe('Email Attachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureAuthenticated.mockResolvedValue('dummy_token');
  });

  describe('handleReadEmail with attachments', () => {
    test('should list attachments if present', async () => {
      callGraphAPI
        .mockResolvedValueOnce({
          id: 'msg123',
          subject: 'Test with attachments',
          hasAttachments: true,
          from: { emailAddress: { name: 'Sender', address: 'sender@example.com' } },
          toRecipients: [],
          receivedDateTime: '2024-01-01T00:00:00Z'
        })
        .mockResolvedValueOnce({
          value: [
            { id: 'att1', name: 'test.txt', contentType: 'text/plain', size: 100, isInline: false }
          ]
        });

      const result = await handleReadEmail({ id: 'msg123' });
      expect(result.content[0].text).toContain('Attachments:');
      expect(result.content[0].text).toContain('test.txt');
      expect(callGraphAPI).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleSendEmail with attachments', () => {
    test('should send email with formatted attachments', async () => {
      callGraphAPI.mockResolvedValue({});

      const args = {
        to: 'recipient@example.com',
        subject: 'Hello',
        body: 'World',
        attachments: [
          { name: 'hello.txt', contentType: 'text/plain', contentBytes: 'SGVsbG8=' }
        ]
      };

      await handleSendEmail(args);

      expect(callGraphAPI).toHaveBeenCalledWith(
        expect.any(String),
        'POST',
        'me/sendMail',
        expect.objectContaining({
          message: expect.objectContaining({
            attachments: [
              {
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: 'hello.txt',
                contentType: 'text/plain',
                contentBytes: 'SGVsbG8='
              }
            ]
          })
        })
      );
    });
  });
});
