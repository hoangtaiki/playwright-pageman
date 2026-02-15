<div align="center">
<h1>playwright-pageman</h1>

[![npm version](https://img.shields.io/npm/v/playwright-pageman.svg)](https://www.npmjs.com/package/playwright-pageman)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/hoangtaiki/playwright-pageman/actions/workflows/ci.yml/badge.svg)](https://github.com/hoangtaiki/playwright-pageman/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/hoangtaiki/playwright-pageman/branch/main/graph/badge.svg)](https://codecov.io/gh/hoangtaiki/playwright-pageman)
[![Downloads](https://img.shields.io/npm/dt/playwright-pageman.svg)](https://www.npmjs.com/package/playwright-pageman)

A lightweight Playwright fixture that **automatically tracks and closes extra pages (and optional contexts)** created during your tests — even when they fail, timeout, or retry.

</div>

## The Problem

When tests create extra pages (via `browser.newPage()`, popups, `window.open()`, etc.), those pages stay open until the **entire test suite finishes** — not just the individual test. This is especially painful in headed mode on Linux CI servers where leaked browser windows pile up.

Wrapping everything in `try...finally` is verbose, error-prone, and easy to forget.

## The Solution

**`playwright-pageman` automatically tracks and closes all pages created via `browser.newPage()` — no manual tracking needed!** Just install, import, and start creating pages. Cleanup happens **reliably after each test** thanks to Playwright's fixture lifecycle.

For pages created via `context.newPage()` or popups, simply push them into the `extraPages` fixture for the same automatic cleanup.

## Installation

```bash
npm install playwright-pageman
```

## Quick Start

```typescript
import { test, expect } from 'playwright-pageman';

// Auto-tracking is ON by default — just create pages!
test('multi-page workflow', async ({ browser }) => {
  // Pages created via browser.newPage() are automatically tracked
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();

  await page1.goto('https://example.com');
  await page2.goto('https://example.com/other');

  // ... your test logic ...

  // No cleanup needed! Pages are auto-closed after the test.
});

// For pages from contexts or popups, use extraPages.push():
test('with context pages', async ({ browser, extraPages }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  extraPages.push(page); // Manual tracking for context.newPage()

  // Auto-closed after the test
});
```

## Features

- **🎯 Auto-tracking enabled by default** — pages from `browser.newPage()` are automatically tracked and closed
- **🚀 Zero boilerplate** — no manual `push()`, no `try...finally` everywhere
- **🛡️ Handles failures, timeouts, and retries** gracefully — cleanup always runs
- **🔄 Auto-closes in reverse order** (safer for parent/child pages)
- **📦 Optional manual tracking** — use `extraPages.push()` for `context.newPage()` or popups
- **🎭 `extraContexts` fixture** for isolated browser contexts
- **⚡ Works with parallel workers** — each test gets its own fixture instance
- **⚙️ Configurable** via `test.use()` or project config

## API Reference

### `extraPages` Fixture

| Method / Property | Description                                     |
| ----------------- | ----------------------------------------------- |
| `push(...pages)`  | Track one or more pages for auto-cleanup        |
| `length`          | Number of currently tracked pages               |
| `pages`           | Readonly snapshot of tracked pages              |
| `remove(page)`    | Remove a page from tracking (returns `boolean`) |
| `closeAll()`      | Close all tracked pages immediately             |

### `extraContexts` Fixture

| Method / Property   | Description                                        |
| ------------------- | -------------------------------------------------- |
| `push(...contexts)` | Track one or more contexts for auto-cleanup        |
| `length`            | Number of currently tracked contexts               |
| `contexts`          | Readonly snapshot of tracked contexts              |
| `remove(context)`   | Remove a context from tracking (returns `boolean`) |
| `closeAll()`        | Close all tracked contexts immediately             |

### Configuration

Configure via `test.use()` or in your `playwright.config.ts`:

```typescript
import { test } from 'playwright-pageman';
import type { PageManOptions } from 'playwright-pageman';

test.use({
  pageManOptions: {
    closeTimeout: 5000, // Max ms to wait per page/context close (default: 5000)
    logCleanup: false, // Log cleanup actions to stdout (default: false)
    autoTrack: true, // Auto-track browser.newPage() calls (default: true)
  } as PageManOptions,
});
```

Or in `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';
import type { PageManOptions } from 'playwright-pageman';

export default defineConfig({
  use: {
    pageManOptions: {
      closeTimeout: 5000,
      logCleanup: true,
      autoTrack: true, // Already enabled by default!
    } as PageManOptions,
  },
});
```

**To disable auto-tracking** (if you prefer manual tracking only):

```typescript
test.use({
  pageManOptions: { autoTrack: false } as PageManOptions,
});
```

### Auto-Tracking Mode (Enabled by Default!)

**Auto-tracking is ON by default** — every call to `browser.newPage()` automatically tracks the created page for cleanup:

```typescript
test('auto-tracked pages', async ({ browser, extraPages }) => {
  // These pages are automatically tracked — no push() needed!
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();

  console.log(extraPages.length); // 2

  // All pages will be auto-closed after the test finishes
});
```

#### Important: Default `page` Fixture Behavior

**The default `page` fixture is NOT auto-tracked**, even when `autoTrack: true`. This is because Playwright creates it internally via `context.newPage()`, not `browser.newPage()`.

```typescript
// Without page fixture - only auto-tracked pages
test('scenario 1', async ({ browser, extraPages }) => {
  const newPage = await browser.newPage();
  console.log(extraPages.length); // 1 (only newPage is tracked)
});

// With page fixture - default page is NOT auto-tracked
test('scenario 2', async ({ page, browser, extraPages }) => {
  const newPage = await browser.newPage();
  console.log(extraPages.length); // 1 (only newPage is tracked)
  // 'page' fixture exists but is NOT tracked
});

// If you need to track the default page fixture:
test('scenario 3', async ({ page, browser, extraPages }) => {
  extraPages.push(page); // Manually track default page
  const newPage = await browser.newPage();
  console.log(extraPages.length); // 2 (both pages tracked)
});
```

> **Note:** Only `browser.newPage()` is auto-tracked. Pages created via `context.newPage()` must still be manually pushed.

### Global Accessors

Access the current test's fixtures from page objects or helper functions:

```typescript
import { extraPages, getExtraPages } from 'playwright-pageman';

class CheckoutPage {
  async openPaymentInNewTab(context: BrowserContext) {
    const page = await context.newPage();
    extraPages.push(page); // Uses the global proxy
    await page.goto('/payment');
    return page;
  }
}

// Or with the function form:
function trackPage(page: Page) {
  getExtraPages().push(page);
}
```

## Examples

### Tracking popup windows

```typescript
test('handle popup', async ({ page, context, extraPages }) => {
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('a[target="_blank"]')]);

  extraPages.push(popup);

  await expect(popup).toHaveTitle('Popup Page');
  // popup auto-closes after the test
});
```

### Isolated contexts

```typescript
test('isolated sessions', async ({ browser, extraContexts }) => {
  const userContext = await browser.newContext();
  const adminContext = await browser.newContext();

  extraContexts.push(userContext, adminContext);

  const userPage = await userContext.newPage();
  const adminPage = await adminContext.newPage();

  // Both contexts (and their pages) auto-close after the test
});
```

## License

MIT
