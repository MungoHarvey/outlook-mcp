/**
 * Contacts module exports
 */
const handleListContacts = require('./list');
const handleCreateContact = require('./create');
const handleGetContact = require('./get');
const handleSearchContacts = require('./search');
const handleUpdateContact = require('./update');

const contactsTools = [
  {
    name: 'list-contacts',
    description: 'Lists contacts from your Outlook address book',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of contacts to retrieve (default 10, max 50)' },
        folderId: { type: 'string', description: 'Optional ID of a specific contact folder' }
      }
    },
    handler: handleListContacts
  },
  {
    name: 'create-contact',
    description: 'Creates a new contact in Outlook',
    inputSchema: {
      type: 'object',
      properties: {
        givenName: { type: 'string' },
        surname: { type: 'string' },
        emailAddresses: { type: 'array', items: { type: 'string' } },
        mobilePhone: { type: 'string' },
        businessPhones: { type: 'array', items: { type: 'string' } },
        folderId: { type: 'string', description: 'Optional ID of a specific contact folder' }
      }
    },
    handler: handleCreateContact
  },
  {
    name: 'get-contact',
    description: 'Gets detailed information for a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The ID of the contact to retrieve' }
      },
      required: ['contactId']
    },
    handler: handleGetContact
  },
  {
    name: 'search-contacts',
    description: 'Searches for contacts by name or email address',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search term (name or email)' }
      },
      required: ['query']
    },
    handler: handleSearchContacts
  },
  {
    name: 'update-contact',
    description: 'Updates an existing contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The ID of the contact to update' },
        givenName: { type: 'string' },
        surname: { type: 'string' },
        emailAddresses: { type: 'array', items: { type: 'string' } },
        mobilePhone: { type: 'string' },
        businessPhones: { type: 'array', items: { type: 'string' } },
        companyName: { type: 'string' },
        jobTitle: { type: 'string' }
      },
      required: ['contactId']
    },
    handler: handleUpdateContact
  }
];

module.exports = { contactsTools };
