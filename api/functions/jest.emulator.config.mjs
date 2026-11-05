import config from './jest.config.mjs';

export default {
  ...config,
  moduleNameMapper: {},
  testMatch: ['**/__tests__/experiment/ownership-emulator.test.js'],
};
