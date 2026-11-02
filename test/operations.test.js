'use strict';

const { API_PATH, App, api, appTester, bundle, expectRejection } = require('./helpers');

describe('New Blocklist Entry', () => {
  const perform = App.triggers.new_blocklist_entry.operation.perform;

  it('sends the filters, dedupes by IP and returns newest first', async () => {
    api()
      .get(`${API_PATH}/blocklist`)
      .query({
        format: 'json',
        confidenceMinimum: '90',
        days: '7',
        limit: '500',
        ipVersion: '4',
        onlyCountries: 'CN,RU',
        exceptCountries: 'GB',
      })
      .reply(200, {
        meta: { generatedAt: '2026-11-02T08:00:00Z' },
        data: [
          { ipAddress: '198.51.100.4', abuseConfidenceScore: 100, countryCode: 'CN', lastReportedAt: '2026-11-01T10:00:00Z' },
          { ipAddress: '203.0.113.50', abuseConfidenceScore: 95, countryCode: 'RU', lastReportedAt: '2026-11-02T07:00:00Z' },
          { ipAddress: '198.51.100.4', abuseConfidenceScore: 100, countryCode: 'CN', lastReportedAt: '2026-11-01T10:00:00Z' },
          { abuseConfidenceScore: 99 },
        ],
      });

    const results = await appTester(
      perform,
      bundle({
        confidenceMinimum: '90',
        days: '7',
        limit: '500',
        ipVersion: '4',
        onlyCountries: 'cn, ru',
        exceptCountries: 'GB',
      }),
    );

    expect(results.map((entry) => entry.id)).toEqual(['203.0.113.50', '198.51.100.4']);
    expect(results[0]).toEqual({
      id: '203.0.113.50',
      ip_address: '203.0.113.50',
      ip_version: 4,
      abuse_confidence_score: 95,
      country_code: 'RU',
      last_reported_at: '2026-11-02T07:00:00Z',
      link: 'https://isipsafe.com/ip/203.0.113.50',
    });
  });

  it('uses the defaults and accepts plain address strings', async () => {
    api()
      .get(`${API_PATH}/blocklist`)
      .query({ format: 'json', confidenceMinimum: '75', days: '30', limit: '1000' })
      .reply(200, { data: ['2001:db8::7'] });

    const results = await appTester(perform, bundle());

    expect(results).toEqual([
      {
        id: '2001:db8::7',
        ip_address: '2001:db8::7',
        ip_version: 6,
        abuse_confidence_score: null,
        country_code: null,
        last_reported_at: null,
        link: 'https://isipsafe.com/ip/2001%3Adb8%3A%3A7',
      },
    ]);
  });

  it.each([
    [{ onlyCountries: 'China' }, 'two-letter country codes'],
    [{ ipVersion: '5' }, 'IP version must be 4 or 6.'],
    [{ confidenceMinimum: '0' }, 'Minimum confidence must be a whole number from 1 to 100.'],
    [{ limit: '20000' }, 'Maximum entries must be a whole number from 1 to 10000.'],
  ])('rejects %p', async (inputData, message) => {
    const result = await expectRejection(appTester(perform, bundle(inputData)));

    expect(result.message).toContain(message);
  });

  it('needs a valid key', async () => {
    api().get(`${API_PATH}/blocklist`).query(true).reply(401, { errors: [{ detail: 'API key required.' }] });

    const { error } = await expectRejection(appTester(perform, bundle()));

    expect(error.name).toBe('ExpiredAuthError');
  });
});

describe('Categories (hidden trigger)', () => {
  it('returns choices keyed by slug', async () => {
    api()
      .get(`${API_PATH}/categories`)
      .reply(200, {
        data: [
          { id: 22, slug: 'ssh', name: 'SSH', group: 'Authentication', description: 'Abuse of the SSH service.' },
          { id: 18, slug: 'brute-force', name: 'Brute-Force', group: null },
          { id: 99, name: 'No slug' },
        ],
      });

    const results = await appTester(App.triggers.categories.operation.perform, bundle());

    expect(results).toEqual([
      {
        id: 22,
        slug: 'ssh',
        name: 'SSH (Authentication)',
        title: 'SSH',
        group: 'Authentication',
        description: 'Abuse of the SSH service.',
      },
      { id: 18, slug: 'brute-force', name: 'Brute-Force', title: 'Brute-Force', group: null, description: null },
    ]);
  });

  it('powers the Report IP categories dropdown', () => {
    const field = App.creates.report_ip.operation.inputFields.find((input) => input.key === 'categories');

    expect(field).toMatchObject({ dynamic: 'categories.slug.name', list: true, required: true });
    expect(App.triggers.categories.display.hidden).toBe(true);
  });
});

describe('Find Reports for IP', () => {
  const perform = App.searches.find_reports.operation.perform;

  it('returns a summary with reports as line items', async () => {
    api()
      .get(`${API_PATH}/reports`)
      .query({ ip: '203.0.113.50', maxAgeInDays: '60', page: '1', perPage: '2' })
      .reply(200, {
        data: {
          ipAddress: '203.0.113.50',
          total: 3,
          page: 1,
          perPage: 2,
          lastPage: 2,
          nextPageUrl: 'https://isipsafe.com/api/v1/reports?ip=203.0.113.50&page=2',
          previousPageUrl: null,
          results: [
            { reportedAt: '2026-11-02T07:37:29Z', comment: 'sshd', categories: ['ssh'], categoryIds: [22] },
            { reportedAt: '2026-11-01T07:37:29Z', comment: null, categories: ['port-scan'], categoryIds: [14] },
          ],
        },
      });

    const [result] = await appTester(perform, bundle({ ip: '203.0.113.50', maxAgeInDays: '60', perPage: '2' }));

    expect(result).toMatchObject({
      id: '203.0.113.50',
      total: 3,
      last_page: 2,
      has_more: true,
      latest_reported_at: '2026-11-02T07:37:29Z',
      latest_comment: 'sshd',
      latest_categories: 'ssh',
    });
    expect(result.reports).toHaveLength(2);
  });

  it('returns nothing when the address has no reports', async () => {
    api()
      .get(`${API_PATH}/reports`)
      .query(true)
      .reply(200, { data: { ipAddress: '203.0.113.9', total: 0, results: [] } });

    const results = await appTester(perform, bundle({ ip: '203.0.113.9' }));

    expect(results).toEqual([]);
  });

  it('rejects a per-page value over 100', async () => {
    const result = await expectRejection(appTester(perform, bundle({ ip: '203.0.113.9', perPage: '500' })));

    expect(result.message).toBe('Reports per page must be a whole number from 1 to 100.');
  });
});

describe('app definition', () => {
  it('gives every visible operation a label, description, sample and output fields', () => {
    const operations = [
      ...Object.values(App.triggers),
      ...Object.values(App.searches),
      ...Object.values(App.creates),
    ];
    for (const operation of operations) {
      expect(operation.noun).toBeTruthy();
      expect(operation.display.label).toBeTruthy();
      expect(operation.display.description).toBeTruthy();
      expect(operation.operation.sample).toBeTruthy();
      expect(operation.operation.outputFields.length).toBeGreaterThan(0);
      for (const field of operation.operation.inputFields || []) {
        expect(field.label).toBeTruthy();
      }
    }
  });
});
