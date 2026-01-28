/**
 * Get contact functionality
 */
const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');

/**
 * Get contact handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleGetContact(args) {
  const { contactId } = args;
  
  if (!contactId) {
    return {
      content: [{ type: 'text', text: 'Contact ID is required.' }]
    };
  }
  
  try {
    const accessToken = await ensureAuthenticated();
    const response = await callGraphAPI(accessToken, 'GET', `me/contacts/${contactId}`);
    
    const emails = (response.emailAddresses || []).map(e => e.address).join(', ');
    const businessPhones = (response.businessPhones || []).join(', ');
    
    const details = [
      `Display Name: ${response.displayName}`,
      `Given Name: ${response.givenName || 'N/A'}`,
      `Surname: ${response.surname || 'N/A'}`,
      `Email(s): ${emails || 'N/A'}`,
      `Mobile: ${response.mobilePhone || 'N/A'}`,
      `Business Phone(s): ${businessPhones || 'N/A'}`,
      `Company: ${response.companyName || 'N/A'}`,
      `Job Title: ${response.jobTitle || 'N/A'}`
    ].join('\n');
    
    return {
      content: [{
        type: 'text',
        text: `Contact Details:\n\n${details}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error getting contact: ${error.message}` }]
    };
  }
}

module.exports = handleGetContact;
