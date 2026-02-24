jest.mock('https');

jest.mock('../../config', () => ({
  GRAPH_API_ENDPOINT: 'https://graph.microsoft.com/v1.0/',
  USE_TEST_MODE: false
}));

jest.mock('../../auth/token-storage-instance', () => ({
  refreshAccessToken: jest.fn()
}));

describe('callGraphAPI', () => {
  let callGraphAPI;
  let tokenStorage;
  let https;
  let responses;
  let requestCalls;

  const setupHttpsMock = () => {
    requestCalls = [];
    https.request = jest.fn((url, options, callback) => {
      requestCalls.push({ url, options });
      const response = responses.shift() || { statusCode: 200, body: '{}' };
      const res = {
        statusCode: response.statusCode,
        on: (event, cb) => {
          if (event === 'data' && response.body !== undefined) {
            cb(Buffer.from(response.body));
          }
          if (event === 'end') {
            cb();
          }
        }
      };
      callback(res);
      return {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };
    });
  };

  beforeEach(() => {
    jest.resetModules();
    responses = [];
    https = require('https');
    tokenStorage = require('../../auth/token-storage-instance');
    tokenStorage.refreshAccessToken.mockReset();
    setupHttpsMock();
    ({ callGraphAPI } = require('../../utils/graph-api'));
  });

  test('refreshes token on 401 and retries once', async () => {
    responses = [
      { statusCode: 401, body: 'Unauthorized' },
      { statusCode: 200, body: JSON.stringify({ id: 'ok' }) }
    ];
    tokenStorage.refreshAccessToken.mockResolvedValue('new_token');

    const result = await callGraphAPI('old_token', 'GET', 'me');

    expect(result).toEqual({ id: 'ok' });
    expect(tokenStorage.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(requestCalls).toHaveLength(2);
    expect(requestCalls[0].options.headers.Authorization).toBe('Bearer old_token');
    expect(requestCalls[1].options.headers.Authorization).toBe('Bearer new_token');
  });

  test('fails after second 401 and asks to re-authenticate', async () => {
    responses = [
      { statusCode: 401, body: 'Unauthorized' },
      { statusCode: 401, body: 'Unauthorized' }
    ];
    tokenStorage.refreshAccessToken.mockResolvedValue('new_token');

    await expect(callGraphAPI('old_token', 'GET', 'me'))
      .rejects
      .toThrow("Authentication expired. Please run the 'authenticate' tool to re-authenticate.");

    expect(tokenStorage.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(requestCalls).toHaveLength(2);
  });

  test('surfaces re-auth error when refresh fails', async () => {
    responses = [
      { statusCode: 401, body: 'Unauthorized' }
    ];
    tokenStorage.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

    await expect(callGraphAPI('old_token', 'GET', 'me'))
      .rejects
      .toThrow("Authentication expired. Please run the 'authenticate' tool to re-authenticate.");

    expect(tokenStorage.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(requestCalls).toHaveLength(1);
  });
});
