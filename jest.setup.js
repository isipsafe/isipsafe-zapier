'use strict';

const nock = require('nock');

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  if (pending.length) {
    throw new Error(`Unused HTTP mocks: ${pending.join(', ')}`);
  }
});

afterAll(() => {
  nock.enableNetConnect();
  nock.restore();
});
