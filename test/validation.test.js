'use strict';

const {
  InputError,
  countCsvRows,
  normalizeCategories,
  normalizeTimestamp,
  validateIp,
  validateReportTarget,
} = require('../lib/validation');
const { isMalicious } = require('../lib/format');

describe('validation helpers', () => {
  it.each([
    ['2026-11-02T08:15:00Z', '2026-11-02T08:15:00Z'],
    ['1793607300', '2026-11-02T08:15:00Z'],
    ['1793607300000', '2026-11-02T08:15:00Z'],
    ['', undefined],
    [null, undefined],
  ])('normalizes timestamp %p', (input, expected) => {
    expect(normalizeTimestamp(input)).toBe(expected);
  });

  it('accepts IPv4 and IPv6 and rejects everything else', () => {
    expect(validateIp('2001:db8::1')).toBe('2001:db8::1');
    expect(validateIp('198.51.100.4')).toBe('198.51.100.4');
    expect(() => validateIp('198.51.100')).toThrow(InputError);
    expect(() => validateIp('::ffff:zz')).toThrow(InputError);
  });

  it('validates report networks by prefix length', () => {
    expect(validateReportTarget('198.51.100.0/24')).toBe('198.51.100.0/24');
    expect(validateReportTarget('198.51.100.4/32')).toBe('198.51.100.4/32');
    expect(validateReportTarget('2001:db8::/56')).toBe('2001:db8::/56');
    expect(() => validateReportTarget('198.51.100.0/23')).toThrow('too large');
    expect(() => validateReportTarget('198.51.100.0/24/1')).toThrow('not a valid');
    expect(() => validateReportTarget('198.51.100.0/')).toThrow('not a valid');
    expect(() => validateReportTarget('2001:db8::/129')).toThrow('not a valid');
  });

  it('flattens category values from dropdowns and mapped text', () => {
    expect(normalizeCategories(['ssh', 'brute-force,ssh', 22])).toEqual(['ssh', 'brute-force', '22']);
    expect(normalizeCategories('ssh, port-scan')).toEqual(['ssh', 'port-scan']);
    expect(() => normalizeCategories(undefined)).toThrow('at least one category');
  });

  it('counts CSV rows with or without a header', () => {
    expect(countCsvRows('IP,Categories\n1.2.3.4,ssh\n\n5.6.7.8,ssh')).toBe(2);
    expect(countCsvRows('"IP",Categories\r\n1.2.3.4,ssh')).toBe(1);
    expect(countCsvRows('1.2.3.4,ssh')).toBe(1);
  });

  it('defines malicious as reported, not allowlisted and at or above the threshold', () => {
    const reported = { isWhitelisted: false, totalReports: 3, abuseConfidenceScore: 75 };
    expect(isMalicious(reported)).toBe(true);
    expect(isMalicious(reported, 76)).toBe(false);
    expect(isMalicious({ ...reported, isWhitelisted: true, abuseConfidenceScore: 100 })).toBe(false);
    expect(isMalicious({ ...reported, totalReports: 0, abuseConfidenceScore: 100 })).toBe(false);
  });
});
