#!/usr/bin/env node
/**
 * Outlook MCP Server - Main entry point
 * 
 * A Model Context Protocol server that provides access to
 * Microsoft Outlook through the Microsoft Graph API.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') }); // Import dotenv package for pulling environment variables

const { Server } = require("@modelcontextprotocol/sdk/server/index.js"); // Import Model Context Protocol SDK
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js"); // Import Model Context Protocol SDK for STDIO
const config = require('./config'); // Import config file

// HTTP server for authentication
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const https = require('https');
const fs = require('fs');
const path = require('path');

console.error(`STARTING ${config.SERVER_NAME.toUpperCase()} MCP SERVER`);

// Import module tools
const { authTools } = require('./auth');
const { calendarTools } = require('./calendar');
const { categoryTools } = require('./category');
const { emailTools } = require('./email');
const { folderTools } = require('./folder');
const { rulesTools } = require('./rules');

// Log startup information
console.error(`STARTING ${config.SERVER_NAME.toUpperCase()} MCP SERVER`);
console.error(`Test mode is ${config.USE_TEST_MODE ? 'enabled' : 'disabled'}`);

// Detect if we should start authentication server as child process
const shouldStartAuthServer = process.argv.includes('--start-auth');
let authServerProcess = null;

// Start authentication server as child process if needed
if (shouldStartAuthServer) {
  const { spawn } = require('child_process');
  const path = require('path');

  console.error('🔄 Starting authentication server as child process...');
  authServerProcess = spawn('node', [path.join(__dirname, 'outlook-auth-server.js')], {
    stdio: ['pipe', 'pipe', 'pipe'], // Don't inherit stdio from parent
    detached: false
  });

  // Handle child process output to prevent it from interfering with MCP communication
  if (authServerProcess.stdout) {
    authServerProcess.stdout.on('data', (data) => {
      console.error(`[AUTH SERVER] ${data.toString().trim()}`);
    });
  }

  if (authServerProcess.stderr) {
    authServerProcess.stderr.on('data', (data) => {
      console.error(`[AUTH SERVER ERROR] ${data.toString().trim()}`);
    });
  }

  authServerProcess.on('error', (error) => {
    console.error('❌ Failed to start authentication server:', error.message);
  });

  authServerProcess.on('exit', (code) => {
    console.error(`🔴 Authentication server exited with code ${code}`);
  });

  // Give the auth server a moment to start
  setTimeout(() => {
    console.error('✅ Authentication server started successfully');
  }, 1000);
}

// Combine all tools
const TOOLS = [
  ...authTools,
  ...calendarTools,
  ...categoryTools,
  ...emailTools,
  ...folderTools,
  ...rulesTools
  // Future modules: contactsTools, etc.
];

// Create server with tools capabilities
const server = new Server(
  { name: config.SERVER_NAME, version: config.SERVER_VERSION },
  { 
    capabilities: { 
      tools: TOOLS.reduce((acc, tool) => {
        acc[tool.name] = {};
        return acc;
      }, {})
    } 
  }
);

// Handle all requests
server.fallbackRequestHandler = async (request) => {
  try {
    const { method, params, id } = request;
    console.error(`REQUEST: ${method} [${id}]`);
    
    // Initialize handler
    if (method === "initialize") {
      console.error(`INITIALIZE REQUEST: ID [${id}]`);
      return {
        protocolVersion: "2024-11-05",
        capabilities: { 
          tools: TOOLS.reduce((acc, tool) => {
            acc[tool.name] = {};
            return acc;
          }, {})
        },
        serverInfo: { name: config.SERVER_NAME, version: config.SERVER_VERSION }
      };
    }
    
    // Tools list handler
    if (method === "tools/list") {
      console.error(`TOOLS LIST REQUEST: ID [${id}]`);
      console.error(`TOOLS COUNT: ${TOOLS.length}`);
      console.error(`TOOLS NAMES: ${TOOLS.map(t => t.name).join(', ')}`);
      
      return {
        tools: TOOLS.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    }
    
    // Required empty responses for other capabilities
    if (method === "resources/list") return { resources: [] };
    if (method === "prompts/list") return { prompts: [] };
    
    // Tool call handler
    if (method === "tools/call") {
      try {
        const { name, arguments: args = {} } = params || {};
        
        console.error(`TOOL CALL: ${name}`);
        
        // Find the tool handler
        const tool = TOOLS.find(t => t.name === name);
        
        if (tool && tool.handler) {
          return await tool.handler(args);
        }
        
        // Tool not found
        return {
          error: {
            code: -32601,
            message: `Tool not found: ${name}`
          }
        };
      } catch (error) {
        console.error(`Error in tools/call:`, error);
        return {
          error: {
            code: -32603,
            message: `Error processing tool call: ${error.message}`
          }
        };
      }
    }
    
    // For any other method, return method not found
    return {
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    };
  } catch (error) {
    console.error(`Error in fallbackRequestHandler:`, error);
    return {
      error: {
        code: -32603,
        message: `Error processing request: ${error.message}`
      }
    };
  }
};

// Start authentication HTTP server
const authServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  if (pathname === '/auth/callback' && parsedUrl.query.code) {
    // Handle OAuth callback - exchange code for tokens
    const postData = querystring.stringify({
      client_id: config.AUTH_CONFIG.clientId,
      client_secret: config.AUTH_CONFIG.clientSecret,
      code: parsedUrl.query.code,
      redirect_uri: config.AUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code',
      scope: config.AUTH_CONFIG.scopes.join(' ')
    });
    
    const options = {
      hostname: 'login.microsoftonline.com',
      path: '/common/oauth2/v2.0/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req2 = https.request(options, (res2) => {
      let data = '';
      res2.on('data', chunk => data += chunk);
      res2.on('end', () => {
        if (res2.statusCode >= 200 && res2.statusCode < 300) {
          const tokens = JSON.parse(data);
          tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
          fs.writeFileSync(config.AUTH_CONFIG.tokenStorePath, JSON.stringify(tokens, null, 2));
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>✅ Authentication Successful!</h1><p>You can close this window and return to Claude.</p>');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>❌ Authentication Failed</h1><p>Please try again.</p>');
        }
      });
    });
    req2.write(postData);
    req2.end();
  } else if (pathname === '/auth') {
    // Redirect to Microsoft login
    const authParams = {
      client_id: parsedUrl.query.client_id || config.AUTH_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: config.AUTH_CONFIG.redirectUri,
      scope: config.AUTH_CONFIG.scopes.join(' '),
      response_mode: 'query'
    };
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${querystring.stringify(authParams)}`;
    res.writeHead(302, { 'Location': authUrl });
    res.end();
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Note: HTTP server is now handled by child process when needed
console.error('🔄 Using child process for authentication server');

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.error('SIGTERM received, shutting down...');

  // Kill authentication server child process if it exists
  if (authServerProcess) {
    console.error('🛑 Terminating authentication server...');
    authServerProcess.kill('SIGTERM');

    // Give it a moment to shut down gracefully
    setTimeout(() => {
      if (!authServerProcess.killed) {
        authServerProcess.kill('SIGKILL');
      }
      process.exit(0);
    }, 2000);
  } else {
    process.exit(0);
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport)
  .then(() => console.error(`${config.SERVER_NAME} connected and listening`))
  .catch(error => {
    console.error(`Connection error: ${error.message}`);
    process.exit(1);
  });
