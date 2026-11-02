'use strict';

const { API_PATH, App, api, appTester, bundle, expectRejection } = require('./helpers');

const perform = App.creates.report_ip.operation.perform;

describe('Report IP', () => {
  it('posts a JSON report with normalized categories, comment and timestamp', async () => {
    let sentBody;
    api()
      .matchHeader('content-type', /application\/json/)
      .post(`${API_PATH}/report`, (body) => {
        sentBody = body;
        return true;
      })
      .reply(200, {
        data: { ipAddress: '203.0.113.50', abuseConfidenceScore: 87, link: 'https://isipsafe.com/ip/203.0.113.50' },
      });

    const result = await appTester(
      perform,
      bundle({
        ip: '203.0.113.50',
        categories: ['ssh', 'brute-force, ssh', ' port-scan '],
        comment: 'sshd: 212 failed logins in 10 minutes',
        timestamp: '2026-11-02T09:15:00+01:00',
      }),
    );

    expect(sentBody).toEqual({
      ip: '203.0.113.50',
      categories: ['ssh', 'brute-force', 'port-scan'],
      comment: 'sshd: 212 failed logins in 10 minutes',
      timestamp: '2026-11-02T08:15:00Z',
    });
    expect(result).toEqual({
      id: '203.0.113.50',
      ip_address: '203.0.113.50',
      abuse_confidence_score: 87,
      link: 'https://isipsafe.com/ip/203.0.113.50',
      categories: 'ssh, brute-force, port-scan',
      duplicate: false,
      message: 'Report saved.',
    });
  });

  it('treats a 429 from /report as a successful duplicate', async () => {
    api()
      .post(`${API_PATH}/report`)
      .reply(429, { errors: [{ detail: 'You already reported this address in the last 15 minutes.', status: 429 }] }, {
        'Retry-After': '900',
      });

    const result = await appTester(perform, bundle({ ip: '127.0.0.2', categories: 'ssh' }));

    expect(result).toMatchObject({ ip_address: '127.0.0.2', duplicate: true, abuse_confidence_score: null });
  });

  it('accepts a small CIDR network', async () => {
    api().post(`${API_PATH}/report`, { ip: '203.0.113.0/24', categories: ['port-scan'] }).reply(200, {
      data: { ipAddress: '203.0.113.0/24', abuseConfidenceScore: 40 },
    });

    const result = await appTester(perform, bundle({ ip: '203.0.113.0/24', categories: ['port-scan'] }));

    expect(result.link).toBe('https://isipsafe.com/ip/203.0.113.0%2F24');
  });

  it('truncates comments to 1024 characters', async () => {
    let sentComment;
    api()
      .post(`${API_PATH}/report`, (body) => {
        sentComment = body.comment;
        return true;
      })
      .reply(200, { data: { ipAddress: '203.0.113.50' } });

    await appTester(perform, bundle({ ip: '203.0.113.50', categories: 'ssh', comment: 'x'.repeat(2000) }));

    expect(sentComment).toHaveLength(1024);
  });

  it('surfaces a 422 detail, such as an allowlisted address', async () => {
    api()
      .post(`${API_PATH}/report`)
      .reply(422, { errors: [{ detail: '8.8.8.8 is allowlisted and cannot be reported.', status: 422 }] });

    const result = await expectRejection(appTester(perform, bundle({ ip: '8.8.8.8', categories: 'ssh' })));

    expect(result).toMatchObject({
      message: '8.8.8.8 is allowlisted and cannot be reported.',
      code: 'InvalidInput',
      status: 422,
    });
  });

  it.each([
    [{ ip: '203.0.0.0/16', categories: 'ssh' }, 'too large to report'],
    [{ ip: '2001:db8::/48', categories: 'ssh' }, '/56 or smaller'],
    [{ ip: '203.0.113.0/33', categories: 'ssh' }, 'not a valid IP address or CIDR network'],
    [{ ip: 'example.com', categories: 'ssh' }, 'not a valid IPv4 or IPv6 address'],
    [{ ip: '203.0.113.50', categories: [] }, 'at least one category'],
    [{ ip: '203.0.113.50', categories: Array.from({ length: 13 }, (_, i) => `c${i}`) }, 'at most 12 categories'],
    [{ ip: '203.0.113.50', categories: 'ssh', timestamp: 'yesterday-ish' }, 'not a valid date'],
  ])('rejects invalid input %p without calling the API', async (inputData, message) => {
    const result = await expectRejection(appTester(perform, bundle(inputData)));

    expect(result.code).toBe('InvalidInput');
    expect(result.message).toContain(message);
  });
});
