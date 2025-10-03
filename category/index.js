const handleListCategories = require('./list');

const categoryTools = [
  {
    name: 'list-categories',
    description: 'Lists available Outlook categories for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: handleListCategories
  }
];

module.exports = {
  categoryTools,
  handleListCategories
};


