/**
 * Microsoft Graph API helper functions
 */
const https = require('https');
const config = require('../config');
const mockData = require('./mock-data');
const tokenStorage = require('../auth/token-storage-instance');

/**
 * Makes a request to the Microsoft Graph API
 * @param {string} accessToken - The access token for authentication
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @param {object} data - Data to send for POST/PUT requests
 * @param {object} queryParams - Query parameters
 * @returns {Promise<object>} - The API response
 */
async function callGraphAPI(accessToken, method, path, data = null, queryParams = {}) {
  // For test tokens, we'll simulate the API call
  if (config.USE_TEST_MODE && accessToken && accessToken.startsWith('test_access_token_')) {
    console.error(`TEST MODE: Simulating ${method} ${path} API call`);
    return mockData.simulateGraphAPIResponse(method, path, data, queryParams);
  }

  try {
    console.error(`Making real API call: ${method} ${path}`);
    
    // Encode path segments properly
    const encodedPath = path.split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    
    // Build query string from parameters with special handling for OData filters
    let queryString = '';
    if (Object.keys(queryParams).length > 0) {
      // Handle $filter parameter specially to ensure proper URI encoding
      const filter = queryParams.$filter;
      if (filter) {
        delete queryParams.$filter; // Remove from regular params
      }
      
      // Build query string with proper encoding for regular params
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, value);
      }
      
      queryString = params.toString();
      
      // Add filter parameter separately with proper encoding
      if (filter) {
        if (queryString) {
          queryString += `&$filter=${encodeURIComponent(filter)}`;
        } else {
          queryString = `$filter=${encodeURIComponent(filter)}`;
        }
      }
      
      if (queryString) {
        queryString = '?' + queryString;
      }
      
      console.error(`Query string: ${queryString}`);
    }
    
    const url = `${config.GRAPH_API_ENDPOINT}${encodedPath}${queryString}`;
    console.error(`Full URL: ${url}`);
    
    const maxAttempts = 3;
    const baseDelayMs = 300;
    const jitter = () => Math.floor(Math.random() * 150);

    const attempt = (attemptNum, resolve, reject, tokenOverride = null, hasRetried401 = false) => {
      const tokenToUse = tokenOverride || accessToken;
      const options = {
        method: method,
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json'
        }
      };
      
      const req = https.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', async () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              responseData = responseData ? responseData : '{}';
              const jsonResponse = JSON.parse(responseData);
              resolve(jsonResponse);
            } catch (error) {
              reject(new Error(`Error parsing API response: ${error.message}`));
            }
          } else if (res.statusCode === 401) {
            if (hasRetried401) {
              reject(new Error("Authentication expired. Please run the 'authenticate' tool to re-authenticate."));
              return;
            }

            try {
              const refreshedToken = await tokenStorage.refreshAccessToken();
              attempt(attemptNum, resolve, reject, refreshedToken, true);
            } catch (refreshError) {
              reject(new Error("Authentication expired. Please run the 'authenticate' tool to re-authenticate."));
            }
          } else if (res.statusCode === 429 || (res.statusCode >= 500 && res.statusCode < 600)) {
            if (attemptNum < maxAttempts) {
              const delay = baseDelayMs * Math.pow(2, attemptNum - 1) + jitter();
              console.error(`Transient error ${res.statusCode}. Retrying in ${delay}ms (attempt ${attemptNum}/${maxAttempts})`);
              setTimeout(() => attempt(attemptNum + 1, resolve, reject, tokenOverride, hasRetried401), delay);
            } else {
              reject(new Error(`API call failed after retries with status ${res.statusCode}: ${responseData}`));
            }
          } else {
            reject(new Error(`API call failed with status ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error) => {
        if (attemptNum < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attemptNum - 1) + jitter();
          console.error(`Network error: ${error.message}. Retrying in ${delay}ms (attempt ${attemptNum}/${maxAttempts})`);
          setTimeout(() => attempt(attemptNum + 1, resolve, reject, tokenOverride, hasRetried401), delay);
        } else {
          reject(new Error(`Network error during API call: ${error.message}`));
        }
      });
      
      if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    };

    return new Promise((resolve, reject) => attempt(1, resolve, reject));
  } catch (error) {
    console.error('Error calling Graph API:', error);
    throw error;
  }
}

module.exports = {
  callGraphAPI
};
