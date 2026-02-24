const TokenStorage = require('./token-storage');
const config = require('../config');

const authConfig = config.AUTH_CONFIG || {};

const tokenStorage = new TokenStorage({
  tokenStorePath: authConfig.tokenStorePath,
  clientId: process.env.MS_CLIENT_ID || authConfig.clientId,
  clientSecret: process.env.MS_CLIENT_SECRET || authConfig.clientSecret,
  redirectUri: process.env.MS_REDIRECT_URI || authConfig.redirectUri,
  scopes: process.env.MS_SCOPES
    ? process.env.MS_SCOPES.split(' ')
    : ['offline_access', ...(authConfig.scopes || [])],
  tokenEndpoint: process.env.MS_TOKEN_ENDPOINT
});

module.exports = tokenStorage;
