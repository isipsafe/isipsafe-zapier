'use strict';

const nock = require('nock');

const { API_PATH, App, TEST_KEY, api, appTester, bundle, expectRejection } = require('./helpers');
const { version } = require('../package.json');

describe('authentication', () => {
  it('validates the key with an authenticated lookup and sends the expected headers', async () => {
    api()
      .matchHeader('user-agent', `isipsafe-zapier/${version}`)
      .matchHeader('accept', 'application/json')
      .get(`${API_PATH}/check`)
      .query({ ip: '127.0.0.1' })
      .reply(200, { data: { ipAddress: '127.0.0.1', isPublic: false } }, { 'X-RateLimit-Limit': '10000' });

    const result = await appTester(App.authentication.test, bundle());

    expect(result).toEqual({ key_hint: '...1234', daily_limit: 10000 });
  });

  it('never puts the key in the query string', async () => {
    let requestedPath = '';
    api()
      .get(`${API_PATH}/check`)
      .query(true)
      .reply(function reply() {
        requestedPath = this.req.path;
        return [200, { data: {} }];
      });

    await appTester(App.authentication.test, bundle());

    expect(requestedPath).not.toContain(TEST_KEY);
    expect(requestedPath).not.toContain('key=');
  });

  it('turns a 401 into an expired-auth error with the API detail', async () => {
    nock('https://isipsafe.com')
      .get(`${API_PATH}/check`)
      .query(true)
      .reply(401, { errors: [{ detail: 'Invalid API key.', status: 401 }] });

    const { error } = await expectRejection(appTester(App.authentication.test, bundle({}, { apiKey: 'sl_wrong' })));

    expect(error.name).toBe('ExpiredAuthError');
    expect(error.message).toContain('Invalid API key.');
    expect(error.message).toContain('https://isipsafe.com/login');
    expect(error.message).not.toContain('sl_wrong');
  });

  it('asks for a key when the field is blank', async () => {
    const result = await expectRejection(appTester(App.authentication.test, bundle({}, { apiKey: '   ' })));

    expect(result.code).toBe('InvalidInput');
    expect(result.message).toContain('https://isipsafe.com/login');
  });

  it('builds a connection label from the key hint', async () => {
    const label = await appTester(App.authentication.connectionLabel, {
      authData: { apiKey: TEST_KEY },
      inputData: { key_hint: '...1234' },
    });

    expect(label).toBe('API key ...1234');
  });
});
