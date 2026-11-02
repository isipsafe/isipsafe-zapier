'use strict';

const { SITE_URL } = require('./lib/constants');
const { unwrap, url } = require('./lib/api');

const test = async (z, bundle) => {
  const apiKey = String(bundle.authData.apiKey || '').trim();
  if (!apiKey) {
    throw new z.errors.Error(`Enter your isIPsafe API key. You can get a free one at ${SITE_URL}/login.`, 'InvalidInput', 400);
  }
  const response = await z.request({
    url: url('/check'),
    method: 'GET',
    params: { ip: '127.0.0.1' },
  });
  unwrap(response);
  const limit = Number.parseInt(response.headers.get('x-ratelimit-limit'), 10);
  return {
    key_hint: apiKey.length > 8 ? `...${apiKey.slice(-4)}` : '',
    daily_limit: Number.isFinite(limit) ? limit : null,
  };
};

const connectionLabel = (z, bundle) => {
  const hint = bundle.inputData && bundle.inputData.key_hint;
  return hint ? `API key ${hint}` : 'API key';
};

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      helpText: `Your isIPsafe API key (it starts with \`sl_\`). Sign in at [isipsafe.com/login](${SITE_URL}/login) to create a free key, then copy it from your account page.`,
    },
  ],
  test,
  connectionLabel,
};
