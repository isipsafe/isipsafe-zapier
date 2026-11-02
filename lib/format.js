'use strict';

const { DEFAULT_MALICIOUS_THRESHOLD } = require('./constants');

const list = (value) => (Array.isArray(value) ? value : []);
const orNull = (value) => (value === undefined ? null : value);
const toInt = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
};

/**
 * An address is malicious only when it has been reported, is not on the
 * allowlist and its score reaches the threshold. Allowlisted addresses such as
 * public DNS resolvers come back with a score of 100 but no reports.
 */
const isMalicious = (data, threshold = DEFAULT_MALICIOUS_THRESHOLD) =>
  !data.isWhitelisted && toInt(data.totalReports) > 0 && toInt(data.abuseConfidenceScore) >= threshold;

const formatReport = (report) => ({
  reported_at: orNull(report.reportedAt),
  comment: orNull(report.comment),
  categories: list(report.categories).join(', '),
  category_ids: list(report.categoryIds).join(', '),
  reporter: orNull(report.reporter),
  reporter_type: orNull(report.reporterType),
  reporter_country_code: orNull(report.reporterCountryCode),
});

const formatCheck = (data, { threshold = DEFAULT_MALICIOUS_THRESHOLD, maxAgeInDays } = {}) => {
  const categories = list(data.categories);
  const result = {
    id: data.ipAddress,
    ip_address: data.ipAddress,
    is_malicious: isMalicious(data, threshold),
    threshold,
    abuse_confidence_score: toInt(data.abuseConfidenceScore),
    confidence_band: orNull(data.confidenceBand),
    total_reports: toInt(data.totalReports),
    num_distinct_users: toInt(data.numDistinctUsers),
    is_whitelisted: Boolean(data.isWhitelisted),
    is_public: data.isPublic === undefined ? true : Boolean(data.isPublic),
    is_tor: Boolean(data.isTor),
    ip_version: orNull(data.ipVersion),
    first_reported_at: orNull(data.firstReportedAt),
    last_reported_at: orNull(data.lastReportedAt),
    categories,
    categories_text: categories.join(', '),
    category_ids: list(data.categoryIds),
    country_code: orNull(data.countryCode),
    country_name: orNull(data.countryName),
    region: orNull(data.region),
    city: orNull(data.city),
    asn: orNull(data.asn),
    isp: orNull(data.isp),
    domain: orNull(data.domain),
    usage_type: orNull(data.usageType),
    hostnames: list(data.hostnames),
    hostnames_text: list(data.hostnames).join(', '),
    listed_networks: list(data.listedNetworks),
    link: orNull(data.link),
    max_age_in_days: maxAgeInDays === undefined ? 30 : maxAgeInDays,
  };
  if (Array.isArray(data.reports)) {
    result.reports = data.reports.map(formatReport);
  }
  return result;
};

module.exports = { formatCheck, formatReport, isMalicious };
