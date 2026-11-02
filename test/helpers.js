'use strict';

const nock = require('nock');
const zapier = require('zapier-platform-core');

const App = require('../index');

const API_ORIGIN = 'https://isipsafe.com';
const API_PATH = '/api/v1';
const TEST_KEY = 'sl_test_0000000000001234';

const appTester = zapier.createAppTester(App);

const api = () => nock(API_ORIGIN, { reqheaders: { authorization: `Bearer ${TEST_KEY}` } });

const bundle = (inputData = {}, authData = { apiKey: TEST_KEY }) => ({ authData, inputData });

const parseError = (error) => {
  try {
    return JSON.parse(error.message);
  } catch {
    return { message: error.message };
  }
};

const expectRejection = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return { error, ...parseError(error) };
  }
  throw new Error('expected the operation to fail');
};

module.exports = { API_PATH, App, TEST_KEY, api, appTester, bundle, expectRejection };
