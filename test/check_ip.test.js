'use strict';

const { API_PATH, App, api, appTester, bundle, expectRejection } = require('./helpers');

const perform = App.searches.check_ip.operation.perform;

const checkData = (overrides = {}) => ({
  ipAddress: '203.0.113.50',
  isPublic: true,
  isWhitelisted: false,
  isTor: false,
  hostnames: ['scanner-7.example.net'],
  ipVersion: 4,
  abuseConfidenceScore: 86,
  confidenceBand: 'High',
  totalReports: 41,
  numDistinctUsers: 6,
  firstReportedAt: '2026-10-02T08:14:11Z',
  lastReportedAt: '2026-10-25T03:12:40Z',
  categories: ['port-scan', 'brute-force', 'ssh'],
  categoryIds: [14, 18, 22],
  countryCode: 'NL',
  countryName: 'Netherlands',
  region: 'North Holland',
  city: 'Amsterdam',
  asn: 64496,
  isp: 'Example Hosting B.V.',
  domain: 'example.net',
  usageType: null,
  link: 'https://isipsafe.com/ip/203.0.113.50',
  listedNetworks: [],
  ...overrides,
});

describe('Check IP Reputation', () => {
  it('returns flattened fields and flags a reported high-score address as malicious', async () => {
    api()
      .get(`${API_PATH}/check`)
      .query({ ip: '203.0.113.50', maxAgeInDays: '30' })
      .reply(200, { data: checkData() });

    const [result] = await appTester(perform, bundle({ ip: ' 203.0.113.50 ' }));

    expect(result).toMatchObject({
      id: '203.0.113.50',
      ip_address: '203.0.113.50',
      is_malicious: true,
      threshold: 75,
      abuse_confidence_score: 86,
      confidence_band: 'High',
      total_reports: 41,
      categories: ['port-scan', 'brute-force', 'ssh'],
      categories_text: 'port-scan, brute-force, ssh',
      country_name: 'Netherlands',
      hostnames_text: 'scanner-7.example.net',
      max_age_in_days: 30,
    });
    expect(result).not.toHaveProperty('reports');
  });

  it('never treats allowlisted addresses as malicious, even with a score of 100', async () => {
    api()
      .get(`${API_PATH}/check`)
      .query({ ip: '8.8.8.8', maxAgeInDays: '30' })
      .reply(200, {
        data: checkData({
          ipAddress: '8.8.8.8',
          abuseConfidenceScore: 100,
          confidenceBand: 'High',
          totalReports: 0,
          numDistinctUsers: 0,
          isWhitelisted: true,
          categories: [],
          categoryIds: [],
        }),
      });

    const [result] = await appTester(perform, bundle({ ip: '8.8.8.8' }));

    expect(result.abuse_confidence_score).toBe(100);
    expect(result.is_whitelisted).toBe(true);
    expect(result.is_malicious).toBe(false);
  });

  it('is not malicious without reports even when not allowlisted', async () => {
    api()
      .get(`${API_PATH}/check`)
      .query(true)
      .reply(200, { data: checkData({ abuseConfidenceScore: 100, totalReports: 0 }) });

    const [result] = await appTester(perform, bundle({ ip: '203.0.113.50' }));

    expect(result.is_malicious).toBe(false);
  });

  it('applies a custom threshold and max age, and passes verbose reports through', async () => {
    api()
      .get(`${API_PATH}/check`)
      .query({ ip: '2001:db8::7', maxAgeInDays: '90', verbose: 'true' })
      .reply(200, {
        data: checkData({
          ipAddress: '2001:db8::7',
          reports: [
            {
              reportedAt: '2026-10-25T03:12:40Z',
              comment: 'sshd',
              categories: ['ssh', 'brute-force'],
              categoryIds: [22, 18],
              reporterType: 'verified',
              reporterCountryCode: 'DE',
            },
          ],
        }),
      });

    const [result] = await appTester(
      perform,
      bundle({ ip: '2001:db8::7', threshold: '90', maxAgeInDays: '90', verbose: true }),
    );

    expect(result.is_malicious).toBe(false);
    expect(result.threshold).toBe(90);
    expect(result.max_age_in_days).toBe(90);
    expect(result.reports).toEqual([
      {
        reported_at: '2026-10-25T03:12:40Z',
        comment: 'sshd',
        categories: 'ssh, brute-force',
        category_ids: '22, 18',
        reporter: null,
        reporter_type: 'verified',
        reporter_country_code: 'DE',
      },
    ]);
  });

  it('fills safe defaults when the API omits fields', async () => {
    api()
      .get(`${API_PATH}/check`)
      .query(true)
      .reply(200, { data: { ipAddress: '203.0.113.9' } });

    const [result] = await appTester(perform, bundle({ ip: '203.0.113.9' }));

    expect(result).toMatchObject({
      is_malicious: false,
      abuse_confidence_score: 0,
      total_reports: 0,
      is_public: true,
      is_whitelisted: false,
      categories: [],
      hostnames: [],
      country_code: null,
      link: null,
    });
  });

  it.each([
    ['not-an-ip', 'not a valid IPv4 or IPv6 address'],
    ['999.1.1.1', 'not a valid IPv4 or IPv6 address'],
    ['203.0.113.0/24', 'not a valid IPv4 or IPv6 address'],
    ['', 'IP address is required'],
  ])('rejects %p before calling the API', async (ip, message) => {
    const result = await expectRejection(appTester(perform, bundle({ ip })));

    expect(result.code).toBe('InvalidInput');
    expect(result.message).toContain(message);
  });

  it('rejects an out-of-range threshold', async () => {
    const result = await expectRejection(appTester(perform, bundle({ ip: '203.0.113.50', threshold: '101' })));

    expect(result.message).toBe('Malicious threshold must be a whole number from 1 to 100.');
  });
});
