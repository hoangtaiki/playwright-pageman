// Export the main test fixture and types
export {
  test,
  expect,
  getExtraPages,
  getExtraContexts,
  getExtraBrowsers,
  extraPages,
  extraContexts,
  extraBrowsers,
} from './page-manager.js';

export type {
  PageManOptions,
  ExtraPages,
  ExtraContexts,
  ExtraBrowsers,
} from './page-manager.js';

// Re-export commonly used Playwright types for convenience
export type { TestInfo, Page, Browser, BrowserContext } from '@playwright/test';
