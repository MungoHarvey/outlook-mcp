/**
 * Update contact functionality
 */
const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');

/**
 * Update contact handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleUpdateContact(args) {
  const { contactId, ...updates } = args;
  
  if (!contactId) {
    return {
      content: [{ type: 'text', text: 'Contact ID is required.' }]
    };
  }
  
  // Format emailAddresses if provided
  if (updates.emailAddresses) {
    updates.emailAddresses = updates.emailAddresses.map(email => ({ address: email, name: email }));
  }
  
  try {
    const accessToken = await ensureAuthenticated();
    const response = await callGraphAPI(accessToken, 'PATCH', `me/contacts/${contactId}`, updates);
    
    return {
      content: [{
        type: 'text',
        text: `Contact '${response.displayName}' has been successfully updated.`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error updating contact: ${error.message}` }]
    };
  }
}

module.exports = handleUpdateContact;
