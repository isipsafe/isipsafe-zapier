'use strict';

const { DEFAULT_TIMEOUT_MS, SITE_URL, USER_AGENT } = require('./constants');

const errorDetail = (response) => {
  const body = response.data;
  const first = body && Array.isArray(body.errors) ? body.errors[0] : undefined;
  if (first && first.detail) {
    return String(first.detail);
  }
  if (body && typeof body.detail === 'string') {
    return body.detail;
  }
  return '';
};

const retryAfterSeconds = (response) => {
  const value = Number.parseInt(response.headers.get('retry-after'), 10);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

const isReportRequest = (request) => {
  if (!request || String(request.method).toUpperCase() !== 'POST') {
    return false;
  }
  try {
    return new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/report');
  } catch {
    return false;
  }
};

const withDetail = (message, detail) => (detail ? `${message} isIPsafe said: ${detail}` : message);

/** Adds the Bearer token, User-Agent and default timeout to every request. */
const setHeader = (headers, name, value) => {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) {
      delete headers[key];
    }
  }
  headers[name] = value;
};

const hasHeader = (headers, name) => Object.keys(headers).some((key) => key.toLowerCase() === name);

const addAuthAndDefaults = (request, z, bundle) => {
  request.headers = request.headers || {};
  const apiKey = String((bundle.authData && bundle.authData.apiKey) || '').trim();
  if (apiKey) {
    setHeader(request.headers, 'authorization', `Bearer ${apiKey}`);
  }
  setHeader(request.headers, 'user-agent', USER_AGENT);
  if (!hasHeader(request.headers, 'accept')) {
    request.headers.accept = 'application/json';
  }
  if (request.timeout === undefined) {
    request.timeout = DEFAULT_TIMEOUT_MS;
  }
  request.throwForThrottlingEarly = false;
  return request;
};

/**
 * Turns isIPsafe error responses into Zapier errors with a readable message.
 * A 429 on POST /report is a duplicate report and is passed through so the
 * Report IP action can return it as a success.
 */
const handleErrors = (response, z) => {
  const { status } = response;
  if (status < 400) {
    return response;
  }
  const detail = errorDetail(response);

  if (status === 401 || status === 403) {
    throw new z.errors.ExpiredAuthError(
      withDetail(
        `Your isIPsafe API key was rejected (HTTP ${status}). Copy a valid key from ${SITE_URL}/login and reconnect your account.`,
        detail,
      ),
    );
  }

  if (status === 429) {
    if (isReportRequest(response.request)) {
      response.isDuplicateReport = true;
      response.skipThrowForStatus = true;
      return response;
    }
    const delay = retryAfterSeconds(response);
    const wait = delay === undefined ? '' : ` Try again in ${delay} seconds.`;
    throw new z.errors.ThrottledError(withDetail(`isIPsafe rate limit reached.${wait}`, detail), delay);
  }

  if (status === 400 || status === 404 || status === 422) {
    throw new z.errors.Error(
      detail || `isIPsafe could not process the request (HTTP ${status}).`,
      'InvalidInput',
      status,
    );
  }

  if (status >= 500) {
    throw new z.errors.Error(
      withDetail(`isIPsafe is temporarily unavailable (HTTP ${status}). Please try again in a few minutes.`, detail),
      'ServerError',
      status,
    );
  }

  throw new z.errors.Error(withDetail(`isIPsafe returned HTTP ${status}.`, detail), 'ApiError', status);
};

module.exports = {
  addAuthAndDefaults,
  handleErrors,
  isReportRequest,
};
