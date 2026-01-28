/**
 * Search contacts functionality
 */
const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');

/**
 * Search contacts handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleSearchContacts(args) {
  const { query } = args;
  
  if (!query) {
    return {
      content: [{ type: 'text', text: 'Search query is required.' }]
    };
  }
  
  try {
    const accessToken = await ensureAuthenticated();
    
    // Using $search for contacts
    const queryParams = {
      '$search': `"${query}"`,
      '$select': 'id,displayName,givenName,surname,emailAddresses'
    };
    
    const response = await callGraphAPI(accessToken, 'GET', 'me/contacts', null, queryParams);
    const contacts = response.value || [];
    
    if (contacts.length === 0) {
      return {
        content: [{ type: 'text', text: `No contacts found matching "${query}".` }]
      };
    }
    
    const formattedContacts = contacts.map(c => {
      const emails = (c.emailAddresses || []).map(e => e.address).join(', ');
      return `- ${c.displayName}${emails ? ` (${emails})` : ''} [ID: ${c.id}]`;
    }).join('\n');
    
    return {
      content: [{
        type: 'text',
        text: `Found ${contacts.length} contacts matching "${query}":\n\n${formattedContacts}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error searching contacts: ${error.message}` }]
    };
  }
}

module.exports = handleSearchContacts;
