const handleListContacts = require('../../contacts/list');
const handleCreateContact = require('../../contacts/create');
const handleGetContact = require('../../contacts/get');
const handleSearchContacts = require('../../contacts/search');
const handleUpdateContact = require('../../contacts/update');
const { callGraphAPI } = require('../../utils/graph-api');
const { ensureAuthenticated } = require('../../auth');

jest.mock('../../utils/graph-api');
jest.mock('../../auth');

describe('Contacts Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureAuthenticated.mockResolvedValue('dummy_token');
  });

  describe('handleListContacts', () => {
    test('should list contacts successfully', async () => {
      callGraphAPI.mockResolvedValue({
        value: [
          { id: '1', displayName: 'John Doe', emailAddresses: [{ address: 'john@example.com' }] }
        ]
      });

      const result = await handleListContacts({ count: 5 });
      expect(result.content[0].text).toContain('Found 1 contacts');
      expect(result.content[0].text).toContain('John Doe');
      expect(callGraphAPI).toHaveBeenCalledWith(expect.any(String), 'GET', 'me/contacts', null, expect.objectContaining({ '$top': 5 }));
    });
  });

  describe('handleCreateContact', () => {
    test('should create contact successfully', async () => {
      callGraphAPI.mockResolvedValue({ id: 'new_id', displayName: 'Jane Doe' });

      const result = await handleCreateContact({ givenName: 'Jane', surname: 'Doe', emailAddresses: ['jane@example.com'] });
      expect(result.content[0].text).toContain('Jane Doe');
      expect(result.content[0].text).toContain('new_id');
      expect(callGraphAPI).toHaveBeenCalledWith(expect.any(String), 'POST', 'me/contacts', expect.objectContaining({ givenName: 'Jane' }));
    });
  });

  describe('handleGetContact', () => {
    test('should get contact details', async () => {
      callGraphAPI.mockResolvedValue({
        displayName: 'John Doe',
        givenName: 'John',
        surname: 'Doe',
        emailAddresses: [{ address: 'john@example.com' }]
      });

      const result = await handleGetContact({ contactId: '123' });
      expect(result.content[0].text).toContain('John Doe');
      expect(result.content[0].text).toContain('john@example.com');
    });
  });

  describe('handleSearchContacts', () => {
    test('should search contacts successfully', async () => {
      callGraphAPI.mockResolvedValue({
        value: [
          { id: '1', displayName: 'John Doe', emailAddresses: [{ address: 'john@example.com' }] }
        ]
      });

      const result = await handleSearchContacts({ query: 'John' });
      expect(result.content[0].text).toContain('Found 1 contacts matching "John"');
      expect(callGraphAPI).toHaveBeenCalledWith(expect.any(String), 'GET', 'me/contacts', null, expect.objectContaining({ '$search': '"John"' }));
    });
  });

  describe('handleUpdateContact', () => {
    test('should update contact successfully', async () => {
      callGraphAPI.mockResolvedValue({ displayName: 'John Updated' });

      const result = await handleUpdateContact({ contactId: '123', givenName: 'John Updated' });
      expect(result.content[0].text).toContain('John Updated');
      expect(callGraphAPI).toHaveBeenCalledWith(expect.any(String), 'PATCH', 'me/contacts/123', expect.objectContaining({ givenName: 'John Updated' }));
    });
  });
});
