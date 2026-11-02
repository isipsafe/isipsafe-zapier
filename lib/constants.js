'use strict';

const { version } = require('../package.json');

module.exports = {
  BASE_URL: 'https://isipsafe.com/api/v1',
  SITE_URL: 'https://isipsafe.com',
  USER_AGENT: `isipsafe-zapier/${version}`,
  DEFAULT_TIMEOUT_MS: 10000,
  BULK_TIMEOUT_MS: 25000,
  DEFAULT_MALICIOUS_THRESHOLD: 75,
  MAX_CATEGORIES: 12,
  MAX_COMMENT_LENGTH: 1024,
  MAX_BULK_ROWS: 10000,
  DEFAULT_BLOCKLIST_LIMIT: 1000,
  MAX_BLOCKLIST_LIMIT: 10000,
};
