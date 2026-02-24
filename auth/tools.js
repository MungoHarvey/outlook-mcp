/**
 * Authentication-related tools for the Outlook MCP server
 */
const config = require('../config');
const tokenManager = require('./token-manager');
const tokenStorage = require('./token-storage-instance');

/**
 * About tool handler
 * @returns {object} - MCP response
 */
async function handleAbout() {
  return {
    content: [{
      type: "text",
      text: `📧 MODULAR Outlook Assistant MCP Server v${config.SERVER_VERSION} 📧\n\nProvides access to Microsoft Outlook email, calendar, and contacts through Microsoft Graph API.\nImplemented with a modular architecture for improved maintainability.`
    }]
  };
}

/**
 * Authentication tool handler
 * @param {object} args - Tool arguments
 * @returns {object} - MCP response
 */
async function handleAuthenticate(args) {
  const force = args && args.force === true;
  
  // For test mode, create a test token
  if (config.USE_TEST_MODE) {
    // Create a test token with a 1-hour expiry
    tokenManager.createTestTokens();
    
    return {
      content: [{
        type: "text",
        text: 'Successfully authenticated with Microsoft Graph API (test mode)'
      }]
    };
  }
  
  // For real authentication, generate an auth URL and instruct the user to visit it
  const authUrl = `${config.AUTH_CONFIG.authServerUrl}/auth?client_id=${config.AUTH_CONFIG.clientId}`;
  
  return {
    content: [{
      type: "text",
      text: `Authentication required. Please visit the following URL to authenticate with Microsoft: ${authUrl}\n\nAfter authentication, you will be redirected back to this application.`
    }]
  };
}

/**
 * Check authentication status tool handler
 * @returns {object} - MCP response
 */
async function handleCheckAuthStatus() {
  console.error('[CHECK-AUTH-STATUS] Starting authentication status check');

  const tokens = await tokenStorage.getTokens();

  console.error(`[CHECK-AUTH-STATUS] Tokens loaded: ${tokens ? 'YES' : 'NO'}`);

  if (!tokens || !tokens.access_token) {
    console.error('[CHECK-AUTH-STATUS] No valid access token found');
    return {
      content: [{ type: "text", text: "Not authenticated" }]
    };
  }

  const now = Date.now();
  const expiresAt = tokens.expires_at || 0;
  const msRemaining = expiresAt - now;
  const isExpired = msRemaining <= 0;
  const isExpiringSoon = !isExpired && msRemaining <= (10 * 60 * 1000);
  const hasRefreshToken = Boolean(tokens.refresh_token);

  let silentRefreshStatus = null;
  if (isExpiringSoon && hasRefreshToken) {
    try {
      await tokenStorage.refreshAccessToken();
      silentRefreshStatus = 'Success';
    } catch (error) {
      silentRefreshStatus = `Failed (${error.message})`;
    }
  }

  const totalMinutes = Math.max(0, Math.floor(msRemaining / 60000));
  const hoursRemaining = Math.floor(totalMinutes / 60);
  const minutesRemaining = totalMinutes % 60;
  const expiresInText = isExpired
    ? 'Expired'
    : `${hoursRemaining} hours ${minutesRemaining} minutes`;

  console.error('[CHECK-AUTH-STATUS] Access token present');
  console.error(`[CHECK-AUTH-STATUS] Token expires at: ${tokens.expires_at}`);
  console.error(`[CHECK-AUTH-STATUS] Current time: ${now}`);

  let statusText = `Authentication Status: Authenticated\n` +
    `Access Token: ${isExpired ? 'Expired' : (isExpiringSoon ? 'Expiring Soon' : 'Valid')}\n` +
    `Expires in: ${expiresInText}\n` +
    `Refresh Token: ${hasRefreshToken ? 'Present' : 'Missing'}`;

  if (silentRefreshStatus) {
    statusText += `\nSilent refresh: ${silentRefreshStatus}`;
  }

  return {
    content: [{ type: "text", text: statusText }]
  };
}

// Tool definitions
const authTools = [
  {
    name: "about",
    description: "Returns information about this Outlook Assistant server",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: handleAbout
  },
  {
    name: "authenticate",
    description: "Authenticate with Microsoft Graph API to access Outlook data",
    inputSchema: {
      type: "object",
      properties: {
        force: {
          type: "boolean",
          description: "Force re-authentication even if already authenticated"
        }
      },
      required: []
    },
    handler: handleAuthenticate
  },
  {
    name: "check-auth-status",
    description: "Check the current authentication status with Microsoft Graph API",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    handler: handleCheckAuthStatus
  }
];

module.exports = {
  authTools,
  handleAbout,
  handleAuthenticate,
  handleCheckAuthStatus
};
