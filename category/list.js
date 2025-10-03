const { callGraphAPI } = require('../utils/graph-api');
const { ensureAuthenticated } = require('../auth');

async function handleListCategories() {
  try {
    const accessToken = await ensureAuthenticated();
    const endpoint = 'me/outlook/masterCategories';
    const response = await callGraphAPI(accessToken, 'GET', endpoint);

    const categories = Array.isArray(response.value) ? response.value : [];

    if (categories.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No categories found. Use Outlook to create categories before assigning them.'
        }]
      };
    }

    const formatted = categories
      .map(category => `• ${category.displayName || category.id}${category.color ? ` (${category.color})` : ''}`)
      .join('\n');

    return {
      content: [{
        type: 'text',
        text: `Available categories:\n${formatted}`
      }]
    };
  } catch (error) {
    if (error.message === 'Authentication required') {
      return {
        content: [{
          type: 'text',
          text: "Authentication required. Please use the 'authenticate' tool first."
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: `Error listing categories: ${error.message}`
      }]
    };
  }
}

module.exports = handleListCategories;


