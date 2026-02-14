import type { TestInfo, Page, BrowserContext } from '@playwright/test';
import { test as base } from '@playwright/test';

// ── Type augmentation ──────────────────────────────────────────────

declare module '@playwright/test' {
  interface PlaywrightTestOptions {
    pageManOptions?: PageManOptions;
  }

  interface PlaywrightWorkerOptions {
    pageManOptions?: PageManOptions;
  }
}

// ── Public interfaces ──────────────────────────────────────────────

export interface PageManOptions {
  /** Max milliseconds to wait when closing each page/context (default: 5000) */
  closeTimeout?: number;
  /** Whether to log cleanup actions to stdout (default: false) */
  logCleanup?: boolean;
  /** Auto-track pages created via browser.newPage() (default: false) */
  autoTrack?: boolean;
}

export interface ExtraPages {
  /** Push one or more pages to be auto-cleaned after the test */
  push(...pages: Page[]): void;
  /** Number of tracked pages */
  readonly length: number;
  /** Remove a specific page from tracking (will NOT auto-close it) */
  remove(page: Page): boolean;
  /** Close all tracked pages immediately */
  closeAll(): Promise<void>;
  /** Get all tracked pages (readonly snapshot) */
  readonly pages: readonly Page[];
}

export interface ExtraContexts {
  /** Push one or more contexts to be auto-cleaned after the test */
  push(...contexts: BrowserContext[]): void;
  /** Number of tracked contexts */
  readonly length: number;
  /** Remove a specific context from tracking (will NOT auto-close it) */
  remove(context: BrowserContext): boolean;
  /** Close all tracked contexts immediately */
  closeAll(): Promise<void>;
  /** Get all tracked contexts (readonly snapshot) */
  readonly contexts: readonly BrowserContext[];
}

// ── Default options ────────────────────────────────────────────────

const defaultOptions: Required<PageManOptions> = {
  closeTimeout: 5000,
  logCleanup: false,
  autoTrack: true,
};

function resolveOptions(testInfo: TestInfo): Required<PageManOptions> {
  const userOptions = (testInfo.project.use as any).pageManOptions || {};
  return { ...defaultOptions, ...userOptions };
}

// ── Internal trackers ──────────────────────────────────────────────

class PageTracker {
  private tracked: Page[] = [];

  constructor(private options: Required<PageManOptions>) {}

  push(...pages: Page[]): void {
    for (const page of pages) {
      if (!this.tracked.includes(page)) {
        this.tracked.push(page);
      }
    }
  }

  get length(): number {
    return this.tracked.length;
  }

  get pages(): readonly Page[] {
    return [...this.tracked];
  }

  remove(page: Page): boolean {
    const index = this.tracked.indexOf(page);
    if (index !== -1) {
      this.tracked.splice(index, 1);
      return true;
    }
    return false;
  }

  async closeAll(): Promise<void> {
    if (this.tracked.length === 0) return;

    const count = this.tracked.length;
    if (this.options.logCleanup) {
      process.stdout.write(
        `[pageman] Closing ${count} tracked page(s) in reverse order\n`
      );
    }

    // Close in reverse order (LIFO) — safer for parent/child pages
    const reversed = [...this.tracked].reverse();

    const closePromises = reversed.map(async page => {
      try {
        if (!page.isClosed()) {
          await Promise.race([
            page.close(),
            new Promise<void>((_, reject) =>
              setTimeout(
                () => reject(new Error('Page close timeout')),
                this.options.closeTimeout
              )
            ),
          ]);
        }
      } catch (error: unknown) {
        if (this.options.logCleanup) {
          const message =
            error instanceof Error ? error.message : String(error);
          process.stdout.write(
            `[pageman] Warning: failed to close page: ${message}\n`
          );
        }
        // Never rethrow during cleanup
      }
    });

    await Promise.allSettled(closePromises);
    this.tracked = [];

    if (this.options.logCleanup) {
      process.stdout.write(
        `[pageman] Successfully cleaned up ${count} page(s)\n`
      );
    }
  }
}

class ContextTracker {
  private tracked: BrowserContext[] = [];

  constructor(private options: Required<PageManOptions>) {}

  push(...contexts: BrowserContext[]): void {
    for (const ctx of contexts) {
      if (!this.tracked.includes(ctx)) {
        this.tracked.push(ctx);
      }
    }
  }

  get length(): number {
    return this.tracked.length;
  }

  get contexts(): readonly BrowserContext[] {
    return [...this.tracked];
  }

  remove(context: BrowserContext): boolean {
    const index = this.tracked.indexOf(context);
    if (index !== -1) {
      this.tracked.splice(index, 1);
      return true;
    }
    return false;
  }

  async closeAll(): Promise<void> {
    if (this.tracked.length === 0) return;

    const count = this.tracked.length;
    if (this.options.logCleanup) {
      process.stdout.write(
        `[pageman] Closing ${count} tracked context(s) in reverse order\n`
      );
    }

    // Close in reverse order (LIFO)
    // Closing a context automatically closes all its pages
    const reversed = [...this.tracked].reverse();

    const closePromises = reversed.map(async ctx => {
      try {
        await Promise.race([
          ctx.close(),
          new Promise<void>((_, reject) =>
            setTimeout(
              () => reject(new Error('Context close timeout')),
              this.options.closeTimeout
            )
          ),
        ]);
      } catch (error: unknown) {
        if (this.options.logCleanup) {
          const message =
            error instanceof Error ? error.message : String(error);
          process.stdout.write(
            `[pageman] Warning: failed to close context: ${message}\n`
          );
        }
        // Never rethrow during cleanup
      }
    });

    await Promise.allSettled(closePromises);
    this.tracked = [];

    if (this.options.logCleanup) {
      process.stdout.write(
        `[pageman] Successfully cleaned up ${count} context(s)\n`
      );
    }
  }
}

// ── Global accessors ───────────────────────────────────────────────

let currentExtraPages: ExtraPages | null = null;
let currentExtraContexts: ExtraContexts | null = null;

function assertExtraPagesActive(): ExtraPages {
  if (!currentExtraPages) {
    throw new Error(
      'extraPages was accessed outside of a test that uses the extraPages fixture. ' +
        'Make sure your test imports { test } from "playwright-pageman" and uses the extraPages fixture.'
    );
  }
  return currentExtraPages;
}

function assertExtraContextsActive(): ExtraContexts {
  if (!currentExtraContexts) {
    throw new Error(
      'extraContexts was accessed outside of a test that uses the extraContexts fixture. ' +
        'Make sure your test imports { test } from "playwright-pageman" and uses the extraContexts fixture.'
    );
  }
  return currentExtraContexts;
}

/**
 * Get the ExtraPages instance for the currently running test.
 *
 * @throws {Error} If called outside of a test using the extraPages fixture.
 */
export function getExtraPages(): ExtraPages {
  return assertExtraPagesActive();
}

/**
 * Get the ExtraContexts instance for the currently running test.
 *
 * @throws {Error} If called outside of a test using the extraContexts fixture.
 */
export function getExtraContexts(): ExtraContexts {
  return assertExtraContextsActive();
}

/**
 * Global ExtraPages proxy — access the current test's page tracker directly.
 * No function call needed, just import and use.
 *
 * @example
 * ```ts
 * import { extraPages } from 'playwright-pageman';
 *
 * async function openNewTab(context: BrowserContext) {
 *   const page = await context.newPage();
 *   extraPages.push(page);
 *   return page;
 * }
 * ```
 */
export const extraPages: ExtraPages = new Proxy({} as ExtraPages, {
  get(_, prop: string) {
    const fixture = assertExtraPagesActive();
    const value = fixture[prop as keyof ExtraPages];
    if (typeof value === 'function') {
      return (value as (...args: any[]) => any).bind(fixture);
    }
    return value;
  },
});

/**
 * Global ExtraContexts proxy — access the current test's context tracker directly.
 * No function call needed, just import and use.
 *
 * @example
 * ```ts
 * import { extraContexts } from 'playwright-pageman';
 *
 * async function createIsolatedContext(browser: Browser) {
 *   const context = await browser.newContext();
 *   extraContexts.push(context);
 *   return context;
 * }
 * ```
 */
export const extraContexts: ExtraContexts = new Proxy({} as ExtraContexts, {
  get(_, prop: string) {
    const fixture = assertExtraContextsActive();
    const value = fixture[prop as keyof ExtraContexts];
    if (typeof value === 'function') {
      return (value as (...args: any[]) => any).bind(fixture);
    }
    return value;
  },
});

// ── Fixtures ───────────────────────────────────────────────────────

export const test = base.extend<{
  extraPages: ExtraPages;
  extraContexts: ExtraContexts;
  _autoTrackSetup: void;
}>({
  // eslint-disable-next-line no-empty-pattern
  extraPages: async ({}, use, testInfo) => {
    const options = resolveOptions(testInfo);
    const tracker = new PageTracker(options);

    const fixture: ExtraPages = {
      push: (...pages) => tracker.push(...pages),
      get length() {
        return tracker.length;
      },
      remove: page => tracker.remove(page),
      closeAll: () => tracker.closeAll(),
      get pages() {
        return tracker.pages;
      },
    };

    // Set global accessor
    currentExtraPages = fixture;

    await use(fixture);

    // Teardown: always close all tracked pages
    try {
      await tracker.closeAll();
    } finally {
      currentExtraPages = null;
    }
  },

  // eslint-disable-next-line no-empty-pattern
  extraContexts: async ({}, use, testInfo) => {
    const options = resolveOptions(testInfo);
    const tracker = new ContextTracker(options);

    const fixture: ExtraContexts = {
      push: (...contexts) => tracker.push(...contexts),
      get length() {
        return tracker.length;
      },
      remove: context => tracker.remove(context),
      closeAll: () => tracker.closeAll(),
      get contexts() {
        return tracker.contexts;
      },
    };

    // Set global accessor
    currentExtraContexts = fixture;

    await use(fixture);

    // Teardown: always close all tracked contexts
    try {
      await tracker.closeAll();
    } finally {
      currentExtraContexts = null;
    }
  },

  // Auto-fixture: when autoTrack is enabled, monkey-patch browser.newPage
  // to automatically push created pages into extraPages
  _autoTrackSetup: [
    async ({ browser, extraPages: fixture }, use, testInfo) => {
      const options = resolveOptions(testInfo);

      if (options.autoTrack) {
        const originalNewPage = browser.newPage.bind(browser);
        browser.newPage = async (...args: any[]) => {
          const page = await originalNewPage(...args);
          fixture.push(page);
          return page;
        };

        await use();

        // Restore original method
        browser.newPage = originalNewPage;
      } else {
        await use();
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
