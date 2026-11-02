'use strict';

const net = require('node:net');

const { BULK_TIMEOUT_MS, DEFAULT_BLOCKLIST_LIMIT, MAX_BLOCKLIST_LIMIT } = require('../lib/constants');
const { ipLink, unwrap, url, withInputErrors } = require('../lib/api');
const { InputError, toInteger } = require('../lib/validation');

const COUNTRY_LIST = /^[A-Za-z]{2}(\s*,\s*[A-Za-z]{2})*$/;

const countries = (value, label) => {
  const text = String(value || '').trim();
  if (!text) {
    return undefined;
  }
  if (!COUNTRY_LIST.test(text)) {
    throw new InputError(`${label} must be two-letter country codes separated by commas, e.g. CN,RU.`);
  }
  return text
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .join(',');
};

const ipVersion = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return undefined;
  }
  if (text !== '4' && text !== '6') {
    throw new InputError('IP version must be 4 or 6.');
  }
  return Number(text);
};

const toEntry = (item) => {
  const entry = typeof item === 'string' ? { ipAddress: item } : item || {};
  const ip = String(entry.ipAddress || entry.ip || '').trim();
  if (!ip) {
    return null;
  }
  return {
    id: ip,
    ip_address: ip,
    ip_version: net.isIP(ip.split('/')[0]) || null,
    abuse_confidence_score: entry.abuseConfidenceScore === undefined ? null : Number(entry.abuseConfidenceScore),
    country_code: entry.countryCode || null,
    last_reported_at: entry.lastReportedAt || null,
    link: entry.link || ipLink(ip),
  };
};

const newestFirst = (a, b) => String(b.last_reported_at || '').localeCompare(String(a.last_reported_at || ''));

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const params = {
    format: 'json',
    confidenceMinimum: toInteger(input.confidenceMinimum, {
      label: 'Minimum confidence',
      min: 1,
      max: 100,
      fallback: 75,
    }),
    days: toInteger(input.days, { label: 'Reported within (days)', min: 1, max: 90, fallback: 30 }),
    limit: toInteger(input.limit, {
      label: 'Maximum entries',
      min: 1,
      max: MAX_BLOCKLIST_LIMIT,
      fallback: DEFAULT_BLOCKLIST_LIMIT,
    }),
    ipVersion: ipVersion(input.ipVersion),
    onlyCountries: countries(input.onlyCountries, 'Only countries'),
    exceptCountries: countries(input.exceptCountries, 'Except countries'),
  };
  for (const name of Object.keys(params)) {
    if (params[name] === undefined) {
      delete params[name];
    }
  }

  const response = await z.request({ url: url('/blocklist'), method: 'GET', params, timeout: BULK_TIMEOUT_MS });
  const data = unwrap(response);
  const items = Array.isArray(data) ? data : [];
  const seen = new Set();
  const entries = [];
  for (const entry of items.map(toEntry)) {
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push(entry);
    }
  }
  return entries.sort(newestFirst);
};

module.exports = {
  key: 'new_blocklist_entry',
  noun: 'Blocklist Entry',
  display: {
    label: 'New Blocklist Entry',
    description: 'Triggers when an IP address is added to the isIPsafe blocklist.',
    directions:
      'Each address triggers once. The blocklist holds the highest-confidence addresses reported recently; use the filters to narrow it.',
  },
  operation: {
    type: 'polling',
    perform: withInputErrors(perform),
    inputFields: [
      {
        key: 'confidenceMinimum',
        label: 'Minimum Confidence Score',
        type: 'integer',
        default: '75',
        helpText: 'Only include addresses with an abuse confidence score of at least this value (1-100).',
      },
      {
        key: 'days',
        label: 'Reported Within (Days)',
        type: 'integer',
        default: '30',
        helpText: 'Only include addresses reported in the last N days (1-90).',
      },
      {
        key: 'ipVersion',
        label: 'IP Version',
        choices: { 4: 'IPv4 only', 6: 'IPv6 only' },
        helpText: 'Leave empty to include both IPv4 and IPv6 addresses.',
      },
      {
        key: 'onlyCountries',
        label: 'Only Countries',
        helpText: 'Two-letter country codes separated by commas, e.g. `CN,RU`. Leave empty for all countries.',
      },
      {
        key: 'exceptCountries',
        label: 'Except Countries',
        helpText: 'Two-letter country codes to leave out, separated by commas, e.g. `GB,IE`.',
      },
      {
        key: 'limit',
        label: 'Maximum Entries per Check',
        type: 'integer',
        default: String(DEFAULT_BLOCKLIST_LIMIT),
        helpText: `How many of the highest-scoring addresses to look at each time Zapier checks (1-${MAX_BLOCKLIST_LIMIT}).`,
      },
    ],
    sample: {
      id: '203.0.113.50',
      ip_address: '203.0.113.50',
      ip_version: 4,
      abuse_confidence_score: 100,
      country_code: 'NL',
      last_reported_at: '2026-11-02T07:37:29Z',
      link: 'https://isipsafe.com/ip/203.0.113.50',
    },
    outputFields: [
      { key: 'id', label: 'ID' },
      { key: 'ip_address', label: 'IP Address' },
      { key: 'ip_version', label: 'IP Version', type: 'integer' },
      { key: 'abuse_confidence_score', label: 'Abuse Confidence Score', type: 'integer' },
      { key: 'country_code', label: 'Country Code' },
      { key: 'last_reported_at', label: 'Last Reported At', type: 'datetime' },
      { key: 'link', label: 'isIPsafe Page URL' },
    ],
  },
};
