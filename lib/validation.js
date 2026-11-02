'use strict';

const net = require('node:net');

const { MAX_BULK_ROWS, MAX_CATEGORIES, MAX_COMMENT_LENGTH } = require('./constants');

const MAX_REPORT_PREFIX = { 4: 24, 6: 56 };

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

const asText = (value) => (value === undefined || value === null ? '' : String(value).trim());

/**
 * Returns the trimmed address when it is a valid IPv4 or IPv6 address.
 * @throws {InputError}
 */
const validateIp = (value, label = 'IP address') => {
  const ip = asText(value);
  if (!ip) {
    throw new InputError(`${label} is required.`);
  }
  if (!net.isIP(ip)) {
    throw new InputError(`"${ip}" is not a valid IPv4 or IPv6 address.`);
  }
  return ip;
};

const parseNetwork = (value) => {
  const [address, prefixText, ...rest] = value.split('/');
  const version = net.isIP(address);
  if (!version || rest.length || !/^\d{1,3}$/.test(prefixText || '')) {
    return null;
  }
  const prefix = Number(prefixText);
  const maxBits = version === 4 ? 32 : 128;
  if (prefix > maxBits) {
    return null;
  }
  return { address, prefix, version };
};

/**
 * Returns the trimmed value when it is an address or a CIDR network small
 * enough to report (IPv4 /24 or longer, IPv6 /56 or longer).
 * @throws {InputError}
 */
const validateReportTarget = (value, label = 'IP address') => {
  const target = asText(value);
  if (!target) {
    throw new InputError(`${label} is required.`);
  }
  if (!target.includes('/')) {
    return validateIp(target, label);
  }
  const network = parseNetwork(target);
  if (!network) {
    throw new InputError(`"${target}" is not a valid IP address or CIDR network.`);
  }
  const minPrefix = MAX_REPORT_PREFIX[network.version];
  if (network.prefix < minPrefix) {
    throw new InputError(
      `"${target}" is too large to report. Use an IPv${network.version} network of /${minPrefix} or smaller.`,
    );
  }
  return target;
};

/**
 * Accepts an array of slugs or IDs, a comma separated string, or a mix of both
 * (Zapier passes mapped values as strings), and returns a de-duplicated list.
 * @throws {InputError}
 */
const normalizeCategories = (value) => {
  const items = Array.isArray(value) ? value : [value];
  const result = [];
  for (const item of items.flatMap((entry) => asText(entry).split(','))) {
    const slug = item.trim();
    if (slug && !result.includes(slug)) {
      result.push(slug);
    }
  }
  if (!result.length) {
    throw new InputError('Choose at least one category, e.g. ssh and brute-force.');
  }
  if (result.length > MAX_CATEGORIES) {
    throw new InputError(`Choose at most ${MAX_CATEGORIES} categories per report (got ${result.length}).`);
  }
  return result;
};

/**
 * Converts any date Zapier can hand over into RFC 3339 UTC, or returns
 * undefined when the field is empty.
 * @throws {InputError}
 */
const normalizeTimestamp = (value) => {
  const text = asText(value);
  if (!text) {
    return undefined;
  }
  let parsed = new Date(text);
  if (/^\d{10}$/.test(text)) {
    parsed = new Date(Number(text) * 1000);
  } else if (/^\d{13}$/.test(text)) {
    parsed = new Date(Number(text));
  }
  if (Number.isNaN(parsed.getTime())) {
    throw new InputError(`"${text}" is not a valid date. Use a format like 2026-11-02T08:15:00Z.`);
  }
  return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

const normalizeComment = (value) => {
  const text = asText(value);
  return text ? text.slice(0, MAX_COMMENT_LENGTH) : undefined;
};

const toInteger = (value, { label, min, max, fallback }) => {
  const text = asText(value);
  if (!text) {
    return fallback;
  }
  const number = Number(text);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new InputError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return number;
};

const csvCell = (value) => {
  const text = asText(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Builds the IP,Categories,ReportDate,Comment CSV the bulk endpoint expects
 * from Zapier line items, validating every row first.
 * @throws {InputError}
 */
const buildBulkCsv = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const lines = ['IP,Categories,ReportDate,Comment'];
  list.forEach((row, index) => {
    const rowLabel = `Row ${index + 1}`;
    if (!row || (!asText(row.ip) && !asText(row.categories))) {
      return;
    }
    let ip;
    let categories;
    let timestamp;
    try {
      ip = validateReportTarget(row.ip, 'IP address');
      categories = normalizeCategories(row.categories);
      timestamp = normalizeTimestamp(row.timestamp);
    } catch (error) {
      throw new InputError(`${rowLabel}: ${error.message}`);
    }
    lines.push([ip, categories.join(','), timestamp || '', normalizeComment(row.comment) || ''].map(csvCell).join(','));
  });
  const count = lines.length - 1;
  if (count > MAX_BULK_ROWS) {
    throw new InputError(`At most ${MAX_BULK_ROWS} reports can be sent at once (got ${count}).`);
  }
  return { csv: `${lines.join('\n')}\n`, count };
};

const countCsvRows = (csv) => {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const hasHeader = lines.length && /^\s*"?ip"?\s*,/i.test(lines[0]);
  return hasHeader ? lines.length - 1 : lines.length;
};

module.exports = {
  InputError,
  buildBulkCsv,
  countCsvRows,
  normalizeCategories,
  normalizeComment,
  normalizeTimestamp,
  toInteger,
  validateIp,
  validateReportTarget,
};
