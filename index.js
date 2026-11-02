'use strict';

const zapier = require('zapier-platform-core');

const packageJson = require('./package.json');
const authentication = require('./authentication');
const { addAuthAndDefaults, handleErrors } = require('./lib/middleware');

const categoriesTrigger = require('./triggers/categories');
const newBlocklistEntryTrigger = require('./triggers/new_blocklist_entry');
const checkIpSearch = require('./searches/check_ip');
const findReportsSearch = require('./searches/find_reports');
const reportIpCreate = require('./creates/report_ip');
const bulkReportCreate = require('./creates/bulk_report');

module.exports = {
  version: packageJson.version,
  platformVersion: zapier.version,

  authentication,

  beforeRequest: [addAuthAndDefaults],
  afterResponse: [handleErrors],

  triggers: {
    [newBlocklistEntryTrigger.key]: newBlocklistEntryTrigger,
    [categoriesTrigger.key]: categoriesTrigger,
  },

  searches: {
    [checkIpSearch.key]: checkIpSearch,
    [findReportsSearch.key]: findReportsSearch,
  },

  creates: {
    [reportIpCreate.key]: reportIpCreate,
    [bulkReportCreate.key]: bulkReportCreate,
  },

  resources: {},
};
