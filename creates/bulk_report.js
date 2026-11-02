'use strict';

const { BULK_TIMEOUT_MS, MAX_BULK_ROWS } = require('../lib/constants');
const { unwrap, url, withInputErrors } = require('../lib/api');
const { InputError, buildBulkCsv, countCsvRows } = require('../lib/validation');

const csvFromInput = (input) => {
  const csvText = String(input.csv || '').trim();
  const rows = Array.isArray(input.reports) ? input.reports : [];
  const hasRows = rows.some((row) => row && (String(row.ip || '').trim() || String(row.categories || '').trim()));

  if (csvText && hasRows) {
    throw new InputError('Fill in either the Reports line items or the CSV field, not both.');
  }
  if (csvText) {
    const count = countCsvRows(csvText);
    if (count === 0) {
      throw new InputError('The CSV has no report rows.');
    }
    if (count > MAX_BULK_ROWS) {
      throw new InputError(`At most ${MAX_BULK_ROWS} reports can be sent at once (got ${count}).`);
    }
    return { csv: `${csvText}\n`, count };
  }
  const built = buildBulkCsv(rows);
  if (built.count === 0) {
    throw new InputError('Add at least one report: fill in the Reports line items or paste CSV text.');
  }
  return built;
};

const perform = async (z, bundle) => {
  const { csv, count } = csvFromInput(bundle.inputData);
  const response = await z.request({
    url: url('/bulk-report'),
    method: 'POST',
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    body: csv,
    timeout: BULK_TIMEOUT_MS,
  });
  const data = unwrap(response) || {};
  const invalid = (Array.isArray(data.invalidReports) ? data.invalidReports : []).map((row) => ({
    row_number: row.rowNumber === undefined ? null : row.rowNumber,
    input: row.input === undefined ? null : row.input,
    error: String(row.error || ''),
  }));
  return {
    id: `bulk-${Date.now()}`,
    rows_sent: count,
    saved_reports: Number(data.savedReports) || 0,
    invalid_count: invalid.length,
    invalid_reports: invalid,
    invalid_summary: invalid.map((row) => `row ${row.row_number}: ${row.error}`).join('; '),
  };
};

module.exports = {
  key: 'bulk_report',
  noun: 'Bulk Report',
  display: {
    label: 'Bulk Report IPs',
    description: 'Reports many abusive IP addresses to isIPsafe in one request.',
    directions:
      'Use the Reports line items, or paste CSV text with the columns IP,Categories,ReportDate,Comment. Up to 10,000 rows.',
  },
  operation: {
    perform: withInputErrors(perform),
    inputFields: [
      {
        key: 'reports',
        label: 'Reports',
        children: [
          {
            key: 'ip',
            label: 'IP Address',
            helpText: 'One address per line item. IPv4 or IPv6 address, or a CIDR network up to /24 (IPv4) or /56 (IPv6).',
          },
          {
            key: 'categories',
            label: 'Categories',
            helpText: 'Category slugs separated by commas, e.g. `ssh,brute-force`. Up to 12.',
          },
          {
            key: 'timestamp',
            label: 'Attack Time',
            type: 'datetime',
            helpText: 'When the attack happened. Leave empty for now.',
          },
          {
            key: 'comment',
            label: 'Comment',
            helpText: 'Public evidence such as a log line. Leave out personal data.',
          },
        ],
      },
      {
        key: 'csv',
        label: 'CSV Text',
        type: 'text',
        helpText:
          'Instead of line items, paste CSV with the columns `IP,Categories,ReportDate,Comment` (header row optional). Wrap categories in quotes when there are several, e.g. `203.0.113.50,"ssh,brute-force",,sshd`.',
      },
    ],
    sample: {
      id: 'bulk-1793606400000',
      rows_sent: 3,
      saved_reports: 2,
      invalid_count: 1,
      invalid_reports: [{ row_number: 3, input: '198.51.100.4', error: 'unknown category "99"' }],
      invalid_summary: 'row 3: unknown category "99"',
    },
    outputFields: [
      { key: 'id', label: 'ID' },
      { key: 'rows_sent', label: 'Rows Sent', type: 'integer' },
      { key: 'saved_reports', label: 'Saved Reports', type: 'integer' },
      { key: 'invalid_count', label: 'Rejected Rows', type: 'integer' },
      { key: 'invalid_summary', label: 'Rejected Rows Summary' },
      { key: 'invalid_reports[]row_number', label: 'Rejected Row Number', type: 'integer' },
      { key: 'invalid_reports[]input', label: 'Rejected Row Input' },
      { key: 'invalid_reports[]error', label: 'Rejected Row Error' },
    ],
  },
};
