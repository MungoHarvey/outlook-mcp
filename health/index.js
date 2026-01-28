const { ensureAuthenticated } = require('../auth');
const { callGraphAPI } = require('../utils/graph-api');

async function handleHealthCheck() {
  try {
    // Authentication
    let tokenStatus = 'unknown';
    let graphStatus = 'unknown';

    try {
      const accessToken = await ensureAuthenticated();
      tokenStatus = 'ok';

      try {
        await callGraphAPI(accessToken, 'GET', 'me', null, { $select: 'id' });
        graphStatus = 'ok';
      } catch (e) {
        graphStatus = `error:${e.message}`;
      }
    } catch (e) {
      tokenStatus = `error:${e.message}`;
    }

    const overall = tokenStatus === 'ok' && graphStatus === 'ok' ? 'healthy' : 'degraded';
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ status: overall, token: tokenStatus, graph: graphStatus })
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `health-check error: ${error.message}` }]
    };
  }
}

const healthTools = [
  {
    name: 'health-check',
    description: 'Checks auth token and Graph reachability',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: handleHealthCheck
  }
];

module.exports = { healthTools };



