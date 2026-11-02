'use strict';

const { MAX_CATEGORIES, MAX_COMMENT_LENGTH } = require('../lib/constants');
const { ipLink, unwrap, url, withInputErrors } = require('../lib/api');
const { normalizeCategories, normalizeComment, normalizeTimestamp, validateReportTarget } = require('../lib/validation');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const ip = validateReportTarget(input.ip);
  const categories = normalizeCategories(input.categories);
  const body = { ip, categories };
  const comment = normalizeComment(input.comment);
  if (comment) {
    body.comment = comment;
  }
  const timestamp = normalizeTimestamp(input.timestamp);
  if (timestamp) {
    body.timestamp = timestamp;
  }

  const response = await z.request({
    url: url('/report'),
    method: 'POST',
    body,
    skipThrowForStatus: true,
  });

  if (response.isDuplicateReport) {
    return {
      id: ip,
      ip_address: ip,
      abuse_confidence_score: null,
      link: ipLink(ip),
      categories: categories.join(', '),
      duplicate: true,
      message: 'This address was already reported from your account in the last 15 minutes, so the report was skipped.',
    };
  }
  response.throwForStatus();

  const data = unwrap(response) || {};
  const ipAddress = data.ipAddress || ip;
  return {
    id: ipAddress,
    ip_address: ipAddress,
    abuse_confidence_score: data.abuseConfidenceScore === undefined ? null : data.abuseConfidenceScore,
    link: data.link || ipLink(ipAddress),
    categories: categories.join(', '),
    duplicate: false,
    message: 'Report saved.',
  };
};

module.exports = {
  key: 'report_ip',
  noun: 'Report',
  display: {
    label: 'Report IP',
    description: 'Reports an abusive IP address or small network to isIPsafe.',
    directions:
      'The same address can be reported once every 15 minutes from one account. Repeats are returned as successful with "Duplicate" set to true.',
  },
  operation: {
    perform: withInputErrors(perform),
    inputFields: [
      {
        key: 'ip',
        label: 'IP Address',
        required: true,
        helpText:
          'The IPv4 or IPv6 address that attacked you, e.g. `203.0.113.50`. A CIDR network up to `/24` (IPv4) or `/56` (IPv6) is also accepted. Private and allowlisted addresses are rejected.',
      },
      {
        key: 'categories',
        label: 'Categories',
        required: true,
        list: true,
        dynamic: 'categories.slug.name',
        helpText: `What the address did, e.g. SSH and Brute-Force. Choose up to ${MAX_CATEGORIES}. When mapping a value, use category slugs separated by commas, e.g. \`ssh,brute-force\`.`,
      },
      {
        key: 'comment',
        label: 'Comment',
        type: 'text',
        helpText: `Evidence such as a log line, up to ${MAX_COMMENT_LENGTH} characters. **Comments are public**, so leave out personal data, hostnames and email addresses.`,
      },
      {
        key: 'timestamp',
        label: 'Attack Time',
        type: 'datetime',
        helpText: 'When the attack happened. Leave empty to use the current time.',
      },
    ],
    sample: {
      id: '203.0.113.50',
      ip_address: '203.0.113.50',
      abuse_confidence_score: 87,
      link: 'https://isipsafe.com/ip/203.0.113.50',
      categories: 'ssh, brute-force',
      duplicate: false,
      message: 'Report saved.',
    },
    outputFields: [
      { key: 'id', label: 'ID' },
      { key: 'ip_address', label: 'IP Address' },
      { key: 'abuse_confidence_score', label: 'Abuse Confidence Score', type: 'integer' },
      { key: 'link', label: 'isIPsafe Page URL' },
      { key: 'categories', label: 'Categories' },
      { key: 'duplicate', label: 'Duplicate', type: 'boolean' },
      { key: 'message', label: 'Message' },
    ],
  },
};
