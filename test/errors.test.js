'use strict';

const { API_PATH, App, api, appTester, bundle, expectRejection } = require('./helpers');
const { isReportRequest } = require('../lib/middleware');

const check = App.searches.check_ip.operation.perform;
const checkBundle = () => bundle({ ip: '203.0.113.50' });
const mockCheck = () => api().get(`${API_PATH}/check`).query(true);

describe('error handling', () => {
  it('maps 429 to a ThrottledError that honours Retry-After', async () => {
    mockCheck().reply(429, { errors: [{ detail: 'Daily limit reached.', status: 429 }] }, { 'Retry-After': '120' });

    const result = await expectRejection(appTester(check, checkBundle()));

    expect(result.error.name).toBe('ThrottledError');
    expect(result.delay).toBe(120);
    expect(result.message).toBe('isIPsafe rate limit reached. Try again in 120 seconds. isIPsafe said: Daily limit reached.');
  });

  it('maps 429 without Retry-After to a ThrottledError with no delay', async () => {
    mockCheck().reply(429, 'Too Many Requests');

    const result = await expectRejection(appTester(check, checkBundle()));

    expect(result.error.name).toBe('ThrottledError');
    expect(result.delay).toBeUndefined();
    expect(result.message).toBe('isIPsafe rate limit reached.');
  });

  it('maps 403 to an expired-auth error', async () => {
    mockCheck().reply(403, { errors: [{ detail: 'This key is disabled.' }] });

    const { error } = await expectRejection(appTester(check, checkBundle()));

    expect(error.name).toBe('ExpiredAuthError');
    expect(error.message).toContain('This key is disabled.');
  });

  it('maps 5xx to a readable server error', async () => {
    mockCheck().reply(503, '<html>Bad gateway</html>');

    const result = await expectRejection(appTester(check, checkBundle()));

    expect(result).toMatchObject({
      code: 'ServerError',
      status: 503,
      message: 'isIPsafe is temporarily unavailable (HTTP 503). Please try again in a few minutes.',
    });
  });

  it('maps other client errors with the API detail', async () => {
    mockCheck().reply(418, { errors: [{ detail: 'Nope.' }] });

    const result = await expectRejection(appTester(check, checkBundle()));

    expect(result).toMatchObject({ code: 'ApiError', status: 418, message: 'isIPsafe returned HTTP 418. isIPsafe said: Nope.' });
  });

  it('falls back to a generic message when a 422 has no detail', async () => {
    mockCheck().reply(422, {});

    const result = await expectRejection(appTester(check, checkBundle()));

    expect(result.message).toBe('isIPsafe could not process the request (HTTP 422).');
  });

  it('rejects a successful response that is not JSON', async () => {
    mockCheck().reply(200, 'maintenance');

    const result = await expectRejection(appTester(check, checkBundle()));

    expect(result.message).toContain('not JSON');
  });

  it('recognises only POST /report as a report request', () => {
    expect(isReportRequest({ method: 'POST', url: 'https://isipsafe.com/api/v1/report' })).toBe(true);
    expect(isReportRequest({ method: 'post', url: 'https://isipsafe.com/api/v1/report/' })).toBe(true);
    expect(isReportRequest({ method: 'POST', url: 'https://isipsafe.com/api/v1/bulk-report' })).toBe(false);
    expect(isReportRequest({ method: 'GET', url: 'https://isipsafe.com/api/v1/report' })).toBe(false);
    expect(isReportRequest({ method: 'POST', url: 'not a url' })).toBe(false);
    expect(isReportRequest(undefined)).toBe(false);
  });
});
