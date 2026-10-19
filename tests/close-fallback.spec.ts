import { test, expect } from '../src/index';

function captureStdout() {
  let output = '';
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: any): boolean => {
    output += String(chunk);
    return original(chunk);
  }) as typeof process.stdout.write;
  return {
    get output() {
      return output;
    },
    restore: () => {
      process.stdout.write = original;
    },
  };
}

const hang = async () => {
  await new Promise(resolve => setTimeout(resolve, 10_000));
};

test.describe('PageMan - close fallback', () => {
  test.use({
    pageManOptions: { closeTimeout: 200, logCleanup: true, autoTrack: false },
  });

  test('closes the context when page.close() hangs', async ({
    browser,
    extraPages: fixture,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.close = hang;
    fixture.push(page);

    const stdout = captureStdout();
    try {
      await fixture.closeAll();
    } finally {
      stdout.restore();
    }

    expect(page.isClosed()).toBe(true);
    expect(browser.contexts()).not.toContain(context);
    expect(stdout.output).toContain(
      'Warning: failed to close page: page close timeout'
    );
    expect(stdout.output).toContain('Recovered by closing its context');
    expect(stdout.output).toContain('1 recovered by fallback');
  });

  test('closes the context when page.close() throws', async ({
    browser,
    extraPages: fixture,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.close = async () => {
      throw new Error('Simulated page close error');
    };
    fixture.push(page);

    await fixture.closeAll();

    expect(page.isClosed()).toBe(true);
    expect(browser.contexts()).not.toContain(context);
  });

  test('a browser.newPage() page whose close hangs is torn down with its context', async ({
    browser,
    extraPages: fixture,
  }) => {
    const before = browser.contexts().length;
    const page = await browser.newPage();
    page.close = hang;
    fixture.push(page);

    await fixture.closeAll();

    expect(page.isClosed()).toBe(true);
    expect(browser.contexts().length).toBe(before);
  });
});

test.describe('PageMan - unrecoverable close failures', () => {
  test.use({
    pageManOptions: { closeTimeout: 200, logCleanup: false, autoTrack: false },
  });

  test('warns even with logCleanup off when the page stays open', async ({
    browser,
    extraPages: fixture,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const realContextClose = context.close.bind(context);
    page.close = async () => {
      throw new Error('page refuses');
    };
    context.close = async () => {
      throw new Error('context refuses');
    };
    fixture.push(page);

    const stdout = captureStdout();
    try {
      await fixture.closeAll();
    } finally {
      stdout.restore();
      context.close = realContextClose;
    }

    expect(page.isClosed()).toBe(false);
    expect(stdout.output).toContain(
      '1 page(s) could not be closed and may leak into later tests'
    );
    expect(stdout.output).toContain('page refuses');
    expect(stdout.output).toContain('fallback failed: context refuses');
    expect(fixture.length).toBe(0);

    await context.close();
  });
});

test.describe('PageMan - strict mode', () => {
  test.use({
    pageManOptions: { closeTimeout: 200, strict: true, autoTrack: false },
  });

  test('closeAll() rejects when a page cannot be closed', async ({
    browser,
    extraPages: fixture,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const realContextClose = context.close.bind(context);
    page.close = async () => {
      throw new Error('page refuses');
    };
    context.close = async () => {
      throw new Error('context refuses');
    };
    fixture.push(page);

    try {
      await expect(fixture.closeAll()).rejects.toThrow(
        /1 page\(s\) could not be closed/
      );
    } finally {
      context.close = realContextClose;
    }
    expect(fixture.length).toBe(0);

    await context.close();
  });

  test('closeAll() resolves when the fallback recovers the page', async ({
    browser,
    extraPages: fixture,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.close = async () => {
      throw new Error('page refuses');
    };
    fixture.push(page);

    await fixture.closeAll();

    expect(page.isClosed()).toBe(true);
  });
});
