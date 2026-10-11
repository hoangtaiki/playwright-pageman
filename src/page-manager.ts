import type { Page, Browser, BrowserContext } from '@playwright/test';
import { test as base } from '@playwright/test';

// ── Type augmentation ──────────────────────────────────────────────

declare module '@playwright/test' {
  // A test-scoped option: settable in the project config `use` and via test.use().
  interface PlaywrightTestOptions {
    pageManOptions?: PageManOptions;
  }
}

// ── Public interfaces ──────────────────────────────────────────────

export interface PageManOptions {
  /** Max milliseconds to wait when closing each page/context (default: 5000) */
  closeTimeout?: number;
  /** Whether to log cleanup actions to stdout (default: false) */
  logCleanup?: boolean;
  /** Auto-track pages created via browser.newPage() (default: true) */
  autoTrack?: boolean;
  /**
   * Fail the test when a tracked resource could not be closed, instead of
   * only printing a warning. A resource that stays open outlives the test and
   * shows up in later tests' screenshots and traces. (default: false)
   */
  strict?: boolean;
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

export interface ExtraBrowsers {
  /** Push one or more browsers to be auto-cleaned after the test */
  push(...browsers: Browser[]): void;
  /** Number of tracked browsers */
  readonly length: number;
  /** Remove a specific browser from tracking (will NOT auto-close it) */
  remove(browser: Browser): boolean;
  /** Close all tracked browsers immediately */
  closeAll(): Promise<void>;
  /** Get all tracked browsers (readonly snapshot) */
  readonly browsers: readonly Browser[];
}

// ── Default options ────────────────────────────────────────────────

const defaultOptions: Required<PageManOptions> = {
  closeTimeout: 5000,
  logCleanup: false,
  autoTrack: true,
  strict: false,
};

function resolveOptions(
  userOptions: PageManOptions | undefined
): Required<PageManOptions> {
  return { ...defaultOptions, ...(userOptions ?? {}) };
}

// ── Internal trackers ──────────────────────────────────────────────

class ResourceTracker<T extends { close(): Promise<void> }> {
  private tracked: T[] = [];

  constructor(
    private options: Required<PageManOptions>,
    private label: string,
    private isClosedCheck?: (item: T) => boolean,
    /** A stronger close to try when item.close() fails or times out. */
    private fallback?: {
      description: string;
      close: (item: T) => Promise<void>;
    }
  ) {}

  push(...items: T[]): void {
    for (const item of items) {
      if (!this.tracked.includes(item)) {
        this.tracked.push(item);
      }
    }
  }

  get length(): number {
    return this.tracked.length;
  }

  get items(): readonly T[] {
    return [...this.tracked];
  }

  remove(item: T): boolean {
    const index = this.tracked.indexOf(item);
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
      this.log(`Closing ${count} tracked ${this.label}(s)`);
    }

    // All closes dispatched concurrently; order of completion is non-deterministic.
    const leaked: string[] = [];
    let recovered = 0;
    const closePromises = this.tracked.map(async item => {
      if (this.isClosedCheck?.(item)) return;
      const reason = await this.attemptClose(() => item.close());
      if (reason === undefined) return;
      if (this.options.logCleanup) {
        this.log(`Warning: failed to close ${this.label}: ${reason}`);
      }
      // A close that failed or timed out must not abandon the resource: it
      // would stay open and leak into later tests. Try the stronger close.
      if (this.fallback) {
        const fallbackReason = await this.attemptClose(() =>
          this.fallback!.close(item)
        );
        if (fallbackReason === undefined) {
          recovered++;
          if (this.options.logCleanup) {
            this.log(`Recovered by ${this.fallback.description}`);
          }
          return;
        }
        leaked.push(`${reason}; fallback failed: ${fallbackReason}`);
      } else {
        leaked.push(reason);
      }
    });

    await Promise.allSettled(closePromises);
    this.tracked = [];

    if (this.options.logCleanup) {
      if (leaked.length === 0 && recovered === 0) {
        this.log(`Successfully cleaned up ${count} ${this.label}(s)`);
      } else {
        this.log(
          `Cleaned up ${count - leaked.length}/${count} ${this.label}(s) ` +
            `(${leaked.length} failed, ${recovered} recovered by fallback)`
        );
      }
    }

    if (leaked.length > 0) {
      const summary =
        `${leaked.length} ${this.label}(s) could not be closed and may leak ` +
        `into later tests: ${leaked.join(' | ')}`;
      if (this.options.strict) {
        throw new Error(`[pageman] ${summary}`);
      }
      // Always visible, regardless of logCleanup: a leaked resource is a
      // problem for every test that runs after this one.
      this.log(`Warning: ${summary}`);
    }
  }

  /** Runs a close against closeTimeout. Resolves to the failure reason, or undefined on success. */
  private async attemptClose(
    close: () => Promise<void>
  ): Promise<string | undefined> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        close(),
        new Promise<void>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`${this.label} close timeout`)),
            this.options.closeTimeout
          );
        }),
      ]);
      return undefined;
    } catch (error: unknown) {
      return error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private log(message: string): void {
    process.stdout.write(`[pageman] ${message}\n`);
  }
}

class PageTracker extends ResourceTracker<Page> {
  constructor(options: Required<PageManOptions>) {
    super(options, 'page', page => page.isClosed(), {
      description: 'closing its context',
      close: page => page.context().close(),
    });
  }

  get pages(): readonly Page[] {
    return this.items;
  }
}

class ContextTracker extends ResourceTracker<BrowserContext> {
  constructor(options: Required<PageManOptions>) {
    // BrowserContext has no isClosed() in Playwright's public API;
    // the try/catch in ResourceTracker.closeAll() handles already-closed contexts.
    super(options, 'context');
  }

  get contexts(): readonly BrowserContext[] {
    return this.items;
  }
}

class BrowserTracker extends ResourceTracker<Browser> {
  constructor(options: Required<PageManOptions>) {
    // Browser has no isClosed(); isConnected() is the inverse signal.
    super(options, 'browser', browser => !browser.isConnected());
  }

  get browsers(): readonly Browser[] {
    return this.items;
  }
}

// ── Global accessors ───────────────────────────────────────────────

let currentExtraPages: ExtraPages | null = null;
let currentExtraContexts: ExtraContexts | null = null;
let currentExtraBrowsers: ExtraBrowsers | null = null;

function assertExtraPagesActive(): ExtraPages {
  /* c8 ignore start -- guard unreachable from the test suite: the auto `_autoTrackSetup`
     fixture depends on `extraPages`, so it is always active during a test. The guard
     still protects real out-of-test access (helpers/page objects at import time). */
  if (!currentExtraPages) {
    throw new Error(
      'extraPages was accessed outside of a test that uses the extraPages fixture. ' +
        'Make sure your test imports { test } from "playwright-pageman" and uses the extraPages fixture.'
    );
  }
  /* c8 ignore stop */
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

function assertExtraBrowsersActive(): ExtraBrowsers {
  if (!currentExtraBrowsers) {
    throw new Error(
      'extraBrowsers was accessed outside of a test that uses the extraBrowsers fixture. ' +
        'Make sure your test imports { test } from "playwright-pageman" and uses the extraBrowsers fixture.'
    );
  }
  return currentExtraBrowsers;
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
 * Get the ExtraBrowsers instance for the currently running test.
 *
 * @throws {Error} If called outside of a test using the extraBrowsers fixture.
 */
export function getExtraBrowsers(): ExtraBrowsers {
  return assertExtraBrowsersActive();
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
  get(_, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
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
  get(_, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
    const fixture = assertExtraContextsActive();
    const value = fixture[prop as keyof ExtraContexts];
    if (typeof value === 'function') {
      return (value as (...args: any[]) => any).bind(fixture);
    }
    return value;
  },
});

/**
 * Global ExtraBrowsers proxy — access the current test's browser tracker directly.
 * No function call needed, just import and use.
 *
 * @example
 * ```ts
 * import { extraBrowsers } from 'playwright-pageman';
 * import { webkit } from '@playwright/test';
 *
 * async function launchSafari() {
 *   const browser = await webkit.launch();
 *   extraBrowsers.push(browser);
 *   return browser;
 * }
 * ```
 */
export const extraBrowsers: ExtraBrowsers = new Proxy({} as ExtraBrowsers, {
  get(_, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;
    const fixture = assertExtraBrowsersActive();
    const value = fixture[prop as keyof ExtraBrowsers];
    if (typeof value === 'function') {
      return (value as (...args: any[]) => any).bind(fixture);
    }
    return value;
  },
});

// ── Fixtures ───────────────────────────────────────────────────────

export const test = base.extend<{
  pageManOptions: PageManOptions;
  extraPages: ExtraPages;
  extraContexts: ExtraContexts;
  extraBrowsers: ExtraBrowsers;
  _autoTrackSetup: void;
}>({
  // Option fixture: `option: true` lets the project config `use` override it and
  // test.use() works as for any fixture. The module augmentation above makes
  // TypeScript treat this as an override of an existing option, whose tuple form
  // does not accept `option`, hence the cast.
  pageManOptions: [defaultOptions, { option: true }] as any,

  extraPages: async ({ pageManOptions }, use) => {
    const options = resolveOptions(pageManOptions);
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

  extraContexts: async ({ pageManOptions }, use) => {
    const options = resolveOptions(pageManOptions);
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

  extraBrowsers: async ({ pageManOptions }, use) => {
    const options = resolveOptions(pageManOptions);
    const tracker = new BrowserTracker(options);

    const fixture: ExtraBrowsers = {
      push: (...browsers) => tracker.push(...browsers),
      get length() {
        return tracker.length;
      },
      remove: browser => tracker.remove(browser),
      closeAll: () => tracker.closeAll(),
      get browsers() {
        return tracker.browsers;
      },
    };

    // Set global accessor
    currentExtraBrowsers = fixture;

    await use(fixture);

    // Teardown: always close all tracked browsers
    try {
      await tracker.closeAll();
    } finally {
      currentExtraBrowsers = null;
    }
  },

  // Auto-fixture: when autoTrack is enabled, monkey-patch browser.newPage
  // to automatically push created pages into extraPages
  _autoTrackSetup: [
    async ({ browser, extraPages: fixture, pageManOptions }, use) => {
      const options = resolveOptions(pageManOptions);

      if (options.autoTrack) {
        const originalNewPage = browser.newPage.bind(browser);
        browser.newPage = async (...args: any[]) => {
          const page = await originalNewPage(...args);
          fixture.push(page);
          return page;
        };

        try {
          await use();
        } finally {
          // Always restore the original method, even if teardown throws
          browser.newPage = originalNewPage;
        }
      } else {
        await use();
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
