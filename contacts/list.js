/**
 * List contacts functionality
 */
const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');

/**
 * List contacts handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleListContacts(args) {
  const { count = 10, folderId } = args;
  
  try {
    const accessToken = await ensureAuthenticated();
    
    let endpoint = folderId ? `me/contactFolders/${folderId}/contacts` : 'me/contacts';
    
    const queryParams = {
      '$top': Math.min(count, 50),
      '$select': 'id,displayName,givenName,surname,emailAddresses,mobilePhone,businessPhones'
    };
    
    const response = await callGraphAPI(accessToken, 'GET', endpoint, null, queryParams);
    const contacts = response.value || [];
    
    if (contacts.length === 0) {
      return {
        content: [{ type: 'text', text: 'No contacts found.' }]
      };
    }
    
    const formattedContacts = contacts.map(c => {
      const emails = (c.emailAddresses || []).map(e => e.address).join(', ');
      return `- ${c.displayName}${emails ? ` (${emails})` : ''} [ID: ${c.id}]`;
    }).join('\n');
    
    return {
      content: [{
        type: 'text',
        text: `Found ${contacts.length} contacts:\n\n${formattedContacts}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error listing contacts: ${error.message}` }]
    };
  }
}

module.exports = handleListContacts;
