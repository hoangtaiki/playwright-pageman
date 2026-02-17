// Export the main test fixture and types
export {
  test,
  expect,
  getExtraPages,
  getExtraContexts,
  extraPages,
  extraContexts,
} from './page-manager.js';

export type {
  PageManOptions,
  ExtraPages,
  ExtraContexts,
} from './page-manager.js';

// Re-export commonly used Playwright types for convenience
export type { TestInfo, Page, Browser, BrowserContext } from '@playwright/test';
