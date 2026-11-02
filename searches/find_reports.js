'use strict';

const { ipLink, unwrap, url, withInputErrors } = require('../lib/api');
const { formatReport } = require('../lib/format');
const { toInteger, validateIp } = require('../lib/validation');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const ip = validateIp(input.ip);
  const params = {
    ip,
    maxAgeInDays: toInteger(input.maxAgeInDays, { label: 'Max age in days', min: 1, max: 365, fallback: 30 }),
    page: toInteger(input.page, { label: 'Page', min: 1, max: 100000, fallback: 1 }),
    perPage: toInteger(input.perPage, { label: 'Reports per page', min: 1, max: 100, fallback: 25 }),
  };
  const response = await z.request({ url: url('/reports'), method: 'GET', params });
  const data = unwrap(response) || {};
  const reports = (Array.isArray(data.results) ? data.results : []).map(formatReport);
  if (!reports.length) {
    return [];
  }
  const latest = reports[0];
  return [
    {
      id: data.ipAddress || ip,
      ip_address: data.ipAddress || ip,
      total: Number(data.total) || reports.length,
      page: Number(data.page) || params.page,
      per_page: Number(data.perPage) || params.perPage,
      last_page: Number(data.lastPage) || 1,
      has_more: Boolean(data.nextPageUrl),
      latest_reported_at: latest.reported_at,
      latest_comment: latest.comment,
      latest_categories: latest.categories,
      link: ipLink(data.ipAddress || ip),
      reports,
    },
  ];
};

module.exports = {
  key: 'find_reports',
  noun: 'Reports',
  display: {
    label: 'Find Reports for IP',
    description: 'Finds the abuse reports filed against an IP address, newest first.',
  },
  operation: {
    perform: withInputErrors(perform),
    inputFields: [
      {
        key: 'ip',
        label: 'IP Address',
        required: true,
        helpText: 'The IPv4 or IPv6 address whose reports you want, e.g. `203.0.113.50`.',
      },
      {
        key: 'maxAgeInDays',
        label: 'Max Age in Days',
        type: 'integer',
        default: '30',
        helpText: 'Only return reports from the last N days (1-365).',
      },
      {
        key: 'perPage',
        label: 'Reports per Page',
        type: 'integer',
        default: '25',
        helpText: 'How many reports to return (1-100).',
      },
      {
        key: 'page',
        label: 'Page',
        type: 'integer',
        default: '1',
        helpText: 'Which page of results to return. Page 1 holds the newest reports.',
      },
    ],
    sample: {
      id: '203.0.113.50',
      ip_address: '203.0.113.50',
      total: 41,
      page: 1,
      per_page: 25,
      last_page: 2,
      has_more: true,
      latest_reported_at: '2026-11-02T07:37:29Z',
      latest_comment: 'sshd: 212 failed logins in 10 minutes',
      latest_categories: 'ssh, brute-force',
      link: 'https://isipsafe.com/ip/203.0.113.50',
      reports: [
        {
          reported_at: '2026-11-02T07:37:29Z',
          comment: 'sshd: 212 failed logins in 10 minutes',
          categories: 'ssh, brute-force',
          category_ids: '22, 18',
          reporter: 'Example Ops',
          reporter_type: 'verified',
          reporter_country_code: 'DE',
        },
      ],
    },
    outputFields: [
      { key: 'id', label: 'ID' },
      { key: 'ip_address', label: 'IP Address' },
      { key: 'total', label: 'Total Reports', type: 'integer' },
      { key: 'page', label: 'Page', type: 'integer' },
      { key: 'per_page', label: 'Reports per Page', type: 'integer' },
      { key: 'last_page', label: 'Last Page', type: 'integer' },
      { key: 'has_more', label: 'Has More Pages', type: 'boolean' },
      { key: 'latest_reported_at', label: 'Latest Report Date', type: 'datetime' },
      { key: 'latest_comment', label: 'Latest Report Comment' },
      { key: 'latest_categories', label: 'Latest Report Categories' },
      { key: 'link', label: 'isIPsafe Page URL' },
      { key: 'reports[]reported_at', label: 'Report Date', type: 'datetime' },
      { key: 'reports[]comment', label: 'Report Comment' },
      { key: 'reports[]categories', label: 'Report Categories' },
      { key: 'reports[]category_ids', label: 'Report Category IDs' },
      { key: 'reports[]reporter', label: 'Reporter' },
      { key: 'reports[]reporter_type', label: 'Reporter Type' },
      { key: 'reports[]reporter_country_code', label: 'Reporter Country Code' },
    ],
  },
};
