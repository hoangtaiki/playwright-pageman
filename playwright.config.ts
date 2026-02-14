import { defineConfig, devices } from '@playwright/test';
import type { PageManOptions } from './src/page-manager';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry always for test reliability */
  retries: 1,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { outputFolder: './playwright-report' }], ['list']],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* PageMan Configuration - autoTrack is ON by default! */
    pageManOptions: {
      closeTimeout: 5000,
      logCleanup: false,
      autoTrack: true, // Auto-tracking enabled by default
    } as PageManOptions,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/.*configuration\.spec\.ts/],
    },

    // Project for testing with logCleanup enabled
    {
      name: 'chromium-log-cleanup',
      use: {
        ...devices['Desktop Chrome'],
        pageManOptions: {
          closeTimeout: 5000,
          logCleanup: true,
          autoTrack: false,
        } as PageManOptions,
      },
      testMatch: [/.*configuration\.spec\.ts/, /.*error-handling\.spec\.ts/],
    },

    // Project for testing error handling with short timeout
    {
      name: 'chromium-short-timeout',
      use: {
        ...devices['Desktop Chrome'],
        pageManOptions: {
          closeTimeout: 100, // Very short timeout to test timeout errors
          logCleanup: true,
          autoTrack: false,
        } as PageManOptions,
      },
      testMatch: /.*error-handling\.spec\.ts/,
    },

    // Project for testing manual-only mode (autoTrack disabled)
    {
      name: 'chromium-manual-only',
      use: {
        ...devices['Desktop Chrome'],
        pageManOptions: {
          closeTimeout: 5000,
          logCleanup: false,
          autoTrack: false,
        } as PageManOptions,
      },
      testIgnore: [/.*configuration\.spec\.ts/, /.*auto-track\.spec\.ts/],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: [/.*configuration\.spec\.ts/],
    },
  ],
});
