'use strict';

const { API_PATH, App, api, appTester, bundle, expectRejection } = require('./helpers');

const perform = App.creates.bulk_report.operation.perform;

const captureCsv = (reply) => {
  const captured = {};
  api()
    .matchHeader('content-type', /^text\/csv/)
    .post(`${API_PATH}/bulk-report`, (body) => {
      captured.body = body;
      return true;
    })
    .reply(200, reply);
  return captured;
};

describe('Bulk Report IPs', () => {
  it('builds a CSV from line items and maps the result', async () => {
    const captured = captureCsv({
      data: {
        savedReports: 2,
        invalidReports: [{ rowNumber: 3, input: '198.51.100.4', error: 'unknown category "99"' }],
      },
    });

    const result = await appTester(
      perform,
      bundle({
        reports: [
          { ip: '203.0.113.50', categories: 'ssh,brute-force', comment: 'sshd: "root" login', timestamp: '' },
          { ip: '2001:db8::7', categories: 'web-app-attack', timestamp: '2026-11-02T08:15:00Z' },
          { ip: '198.51.100.4', categories: '99' },
          { ip: '', categories: '' },
        ],
      }),
    );

    expect(captured.body).toBe(
      [
        'IP,Categories,ReportDate,Comment',
        '203.0.113.50,"ssh,brute-force",,"sshd: ""root"" login"',
        '2001:db8::7,web-app-attack,2026-11-02T08:15:00Z,',
        '198.51.100.4,99,,',
        '',
      ].join('\n'),
    );
    expect(result).toMatchObject({
      rows_sent: 3,
      saved_reports: 2,
      invalid_count: 1,
      invalid_reports: [{ row_number: 3, input: '198.51.100.4', error: 'unknown category "99"' }],
      invalid_summary: 'row 3: unknown category "99"',
    });
  });

  it('sends pasted CSV text as-is', async () => {
    const csv = 'IP,Categories,ReportDate,Comment\n203.0.113.50,"ssh,brute-force",,sshd\n198.51.100.4,port-scan,,';
    const captured = captureCsv({ data: { savedReports: 2, invalidReports: [] } });

    const result = await appTester(perform, bundle({ csv }));

    expect(captured.body).toBe(`${csv}\n`);
    expect(result).toMatchObject({ rows_sent: 2, saved_reports: 2, invalid_count: 0, invalid_summary: '' });
  });

  it('reports the failing row when a line item is invalid', async () => {
    const result = await expectRejection(
      appTester(
        perform,
        bundle({
          reports: [
            { ip: '203.0.113.50', categories: 'ssh' },
            { ip: '10.0.0.300', categories: 'ssh' },
          ],
        }),
      ),
    );

    expect(result.code).toBe('InvalidInput');
    expect(result.message).toBe('Row 2: "10.0.0.300" is not a valid IPv4 or IPv6 address.');
  });

  it.each([
    [{}, 'Add at least one report'],
    [{ reports: [{ ip: '', categories: '' }] }, 'Add at least one report'],
    [{ csv: 'IP,Categories,ReportDate,Comment\n' }, 'The CSV has no report rows.'],
    [
      { csv: '203.0.113.50,ssh,,', reports: [{ ip: '203.0.113.51', categories: 'ssh' }] },
      'either the Reports line items or the CSV field',
    ],
  ])('rejects %p', async (inputData, message) => {
    const result = await expectRejection(appTester(perform, bundle(inputData)));

    expect(result.message).toContain(message);
  });

  it('rejects more than 10,000 rows', async () => {
    const csv = Array.from({ length: 10001 }, () => '203.0.113.50,ssh,,').join('\n');

    const result = await expectRejection(appTester(perform, bundle({ csv })));

    expect(result.message).toBe('At most 10000 reports can be sent at once (got 10001).');
  });

  it('does not treat a bulk 429 as a duplicate', async () => {
    api().post(`${API_PATH}/bulk-report`).reply(429, { errors: [{ detail: 'Slow down.' }] }, { 'Retry-After': '30' });

    const { error, delay } = await expectRejection(appTester(perform, bundle({ csv: '203.0.113.50,ssh,,' })));

    expect(error.name).toBe('ThrottledError');
    expect(delay).toBe(30);
  });
});
