'use strict';

const { DEFAULT_MALICIOUS_THRESHOLD } = require('../lib/constants');
const { unwrap, url, withInputErrors } = require('../lib/api');
const { formatCheck } = require('../lib/format');
const { toInteger, validateIp } = require('../lib/validation');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const ip = validateIp(input.ip);
  const maxAgeInDays = toInteger(input.maxAgeInDays, { label: 'Max age in days', min: 1, max: 365, fallback: 30 });
  const threshold = toInteger(input.threshold, {
    label: 'Malicious threshold',
    min: 1,
    max: 100,
    fallback: DEFAULT_MALICIOUS_THRESHOLD,
  });
  const verbose = input.verbose === true || String(input.verbose).toLowerCase() === 'true';

  const params = { ip, maxAgeInDays };
  if (verbose) {
    params.verbose = 'true';
  }
  const response = await z.request({ url: url('/check'), method: 'GET', params });
  return [formatCheck(unwrap(response), { threshold, maxAgeInDays })];
};

module.exports = {
  key: 'check_ip',
  noun: 'IP Reputation',
  display: {
    label: 'Check IP Reputation',
    description: 'Finds the abuse confidence score, report count and location of an IP address.',
    directions:
      '"Is Malicious" is true only when the address has reports, is not allowlisted and its score reaches the threshold.',
  },
  operation: {
    perform: withInputErrors(perform),
    inputFields: [
      {
        key: 'ip',
        label: 'IP Address',
        required: true,
        helpText: 'The IPv4 or IPv6 address to look up, e.g. `203.0.113.50`.',
      },
      {
        key: 'maxAgeInDays',
        label: 'Max Age in Days',
        type: 'integer',
        default: '30',
        helpText: 'Only count reports from the last N days (1-365).',
      },
      {
        key: 'threshold',
        label: 'Malicious Threshold',
        type: 'integer',
        default: String(DEFAULT_MALICIOUS_THRESHOLD),
        helpText: 'The minimum abuse confidence score (1-100) at which "Is Malicious" becomes true.',
      },
      {
        key: 'verbose',
        label: 'Include Reports',
        type: 'boolean',
        default: 'false',
        helpText: 'Also return up to 100 of the individual reports.',
      },
    ],
    sample: {
      id: '203.0.113.50',
      ip_address: '203.0.113.50',
      is_malicious: true,
      threshold: 75,
      abuse_confidence_score: 86,
      confidence_band: 'High',
      total_reports: 41,
      num_distinct_users: 6,
      is_whitelisted: false,
      is_public: true,
      is_tor: false,
      ip_version: 4,
      first_reported_at: '2026-10-02T08:14:11Z',
      last_reported_at: '2026-10-25T03:12:40Z',
      categories: ['port-scan', 'brute-force', 'ssh'],
      categories_text: 'port-scan, brute-force, ssh',
      category_ids: [14, 18, 22],
      country_code: 'NL',
      country_name: 'Netherlands',
      region: 'North Holland',
      city: 'Amsterdam',
      asn: 64496,
      isp: 'Example Hosting B.V.',
      domain: 'example.net',
      usage_type: null,
      hostnames: ['scanner-7.example.net'],
      hostnames_text: 'scanner-7.example.net',
      listed_networks: [],
      link: 'https://isipsafe.com/ip/203.0.113.50',
      max_age_in_days: 30,
    },
    outputFields: [
      { key: 'id', label: 'ID' },
      { key: 'ip_address', label: 'IP Address' },
      { key: 'is_malicious', label: 'Is Malicious', type: 'boolean' },
      { key: 'threshold', label: 'Malicious Threshold Used', type: 'integer' },
      { key: 'abuse_confidence_score', label: 'Abuse Confidence Score', type: 'integer' },
      { key: 'confidence_band', label: 'Confidence Band' },
      { key: 'total_reports', label: 'Total Reports', type: 'integer' },
      { key: 'num_distinct_users', label: 'Distinct Reporters', type: 'integer' },
      { key: 'is_whitelisted', label: 'Is Allowlisted', type: 'boolean' },
      { key: 'is_public', label: 'Is Public', type: 'boolean' },
      { key: 'is_tor', label: 'Is Tor Exit Node', type: 'boolean' },
      { key: 'ip_version', label: 'IP Version', type: 'integer' },
      { key: 'first_reported_at', label: 'First Reported At', type: 'datetime' },
      { key: 'last_reported_at', label: 'Last Reported At', type: 'datetime' },
      { key: 'categories[]', label: 'Categories' },
      { key: 'categories_text', label: 'Categories (Text)' },
      { key: 'category_ids[]', label: 'Category IDs' },
      { key: 'country_code', label: 'Country Code' },
      { key: 'country_name', label: 'Country' },
      { key: 'region', label: 'Region' },
      { key: 'city', label: 'City' },
      { key: 'asn', label: 'ASN', type: 'integer' },
      { key: 'isp', label: 'ISP' },
      { key: 'domain', label: 'Domain' },
      { key: 'usage_type', label: 'Usage Type' },
      { key: 'hostnames[]', label: 'Hostnames' },
      { key: 'hostnames_text', label: 'Hostnames (Text)' },
      { key: 'link', label: 'isIPsafe Page URL' },
      { key: 'max_age_in_days', label: 'Max Age in Days', type: 'integer' },
      { key: 'reports[]reported_at', label: 'Report Date', type: 'datetime' },
      { key: 'reports[]comment', label: 'Report Comment' },
      { key: 'reports[]categories', label: 'Report Categories' },
      { key: 'reports[]reporter_type', label: 'Reporter Type' },
      { key: 'reports[]reporter_country_code', label: 'Reporter Country Code' },
    ],
  },
};
