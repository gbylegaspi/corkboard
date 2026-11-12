// Playwright for Electron. Each test launches the real app with a temporary profile and a temporary board folder.
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'tests',
  testMatch: /\d+-.*\.spec\.js$/,
  timeout: 180000,
  expect: { timeout: 15000 },
  workers: 1,            // one Electron app at a time (single-instance lock, sounds, focus)
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  globalSetup: require.resolve('./tests/global-setup.js')
});
