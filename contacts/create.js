/**
 * Create contact functionality
 */
const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');

/**
 * Create contact handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleCreateContact(args) {
  const { givenName, surname, emailAddresses, mobilePhone, businessPhones, folderId } = args;
  
  if (!givenName && !surname && (!emailAddresses || emailAddresses.length === 0)) {
    return {
      content: [{ type: 'text', text: 'At least a name or an email address is required to create a contact.' }]
    };
  }
  
  try {
    const accessToken = await ensureAuthenticated();
    
    const endpoint = folderId ? `me/contactFolders/${folderId}/contacts` : 'me/contacts';
    
    const contactData = {
      givenName,
      surname,
      emailAddresses: (emailAddresses || []).map(email => ({ address: email, name: email })),
      mobilePhone,
      businessPhones
    };
    
    const response = await callGraphAPI(accessToken, 'POST', endpoint, contactData);
    
    return {
      content: [{
        type: 'text',
        text: `Contact '${response.displayName}' has been successfully created with ID: ${response.id}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error creating contact: ${error.message}` }]
    };
  }
}

module.exports = handleCreateContact;
