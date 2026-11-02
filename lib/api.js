'use strict';

const { BASE_URL, SITE_URL } = require('./constants');
const { InputError } = require('./validation');

const url = (path) => `${BASE_URL}${path}`;

const unwrap = (response) => {
  const body = response.data;
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data;
  }
  if (body === undefined) {
    throw new Error('isIPsafe returned a response that is not JSON. Please try again later.');
  }
  return body;
};

const ipLink = (ip) => `${SITE_URL}/ip/${encodeURIComponent(ip)}`;

/**
 * Wraps an operation so that invalid user input surfaces as a clear,
 * non-retryable Zapier error instead of a generic failure.
 */
const withInputErrors = (perform) => async (z, bundle) => {
  try {
    return await perform(z, bundle);
  } catch (error) {
    if (error instanceof InputError) {
      throw new z.errors.Error(error.message, 'InvalidInput', 400);
    }
    throw error;
  }
};

module.exports = { ipLink, unwrap, url, withInputErrors };
