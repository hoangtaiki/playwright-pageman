import { test, expect } from '../src/index';

test.describe('AutoTrack - Browser Proxy', () => {
  test('should auto-track pages created via browser.newPage()', async ({
    browser,
    extraPages,
  }) => {
    const options = (test.info().project.use as any)?.pageManOptions;
    test.skip(!options?.autoTrack, 'Requires autoTrack: true');

    // browser.newPage() should automatically push pages to extraPages
    const page = await browser.newPage();

    expect(extraPages.length).toBe(1);
    expect(extraPages.pages[0]).toBe(page);
  });

  test('should auto-track multiple pages', async ({ browser, extraPages }) => {
    const options = (test.info().project.use as any)?.pageManOptions;
    test.skip(!options?.autoTrack, 'Requires autoTrack: true');

    const page1 = await browser.newPage();
    const page2 = await browser.newPage();
    const page3 = await browser.newPage();

    expect(extraPages.length).toBe(3);
    expect(extraPages.pages).toContain(page1);
    expect(extraPages.pages).toContain(page2);
    expect(extraPages.pages).toContain(page3);
  });

  test('should still allow manual push alongside auto-track', async ({
    browser,
    extraPages,
  }) => {
    const options = (test.info().project.use as any)?.pageManOptions;
    test.skip(!options?.autoTrack, 'Requires autoTrack: true');

    // Auto-tracked page
    const autoPage = await browser.newPage();

    // Manually tracked page from a context
    const context = await browser.newContext();
    const manualPage = await context.newPage();
    extraPages.push(manualPage);

    expect(extraPages.length).toBe(2);
    expect(extraPages.pages).toContain(autoPage);
    expect(extraPages.pages).toContain(manualPage);

    await context.close();
  });

  test('should auto-close auto-tracked pages on teardown', async ({
    browser,
    extraPages,
  }) => {
    const options = (test.info().project.use as any)?.pageManOptions;
    test.skip(!options?.autoTrack, 'Requires autoTrack: true');

    const page = await browser.newPage();
    expect(page.isClosed()).toBe(false);
    expect(extraPages.length).toBe(1);

    // Teardown will auto-close this page
  });

  test('context.newPage() should NOT be auto-tracked', async ({
    browser,
    extraPages,
  }) => {
    const options = (test.info().project.use as any)?.pageManOptions;
    test.skip(!options?.autoTrack, 'Requires autoTrack: true');

    // Only browser.newPage() is intercepted, not context.newPage()
    const context = await browser.newContext();
    const _page = await context.newPage();

    // context.newPage() is NOT auto-tracked
    expect(extraPages.length).toBe(0);

    await context.close();
  });

  test('default page fixture should NOT be auto-tracked', async ({
    page,
    extraPages,
  }) => {
    const options = (test.info().project.use as any)?.pageManOptions;
    test.skip(!options?.autoTrack, 'Requires autoTrack: true');

    // The default 'page' fixture is created via context.newPage()
    // which is NOT intercepted by auto-tracking
    expect(page.isClosed()).toBe(false);
    expect(extraPages.length).toBe(0);
    expect(extraPages.pages).not.toContain(page);
  });

  test('should only auto-track browser.newPage() when page fixture is used', async ({
    page,
    browser,
    extraPages,
  }) => {
    const options = (test.info().project.use as any)?.pageManOptions;
    test.skip(!options?.autoTrack, 'Requires autoTrack: true');

    // Call browser.newPage() - this WILL be auto-tracked
    const newPage = await browser.newPage();

    // Result: 1 auto-tracked page (newPage), default page is NOT tracked
    expect(extraPages.length).toBe(1);
    expect(extraPages.pages[0]).toBe(newPage);
    expect(extraPages.pages).not.toContain(page);

    // Total pages in browser: 2 (default page + newPage)
    // But only 1 is auto-tracked
  });

  test('should handle manual push of default page fixture', async ({
    page,
    browser,
    extraPages,
  }) => {
    const options = (test.info().project.use as any)?.pageManOptions;
    test.skip(!options?.autoTrack, 'Requires autoTrack: true');

    // Manually track the default page if needed
    extraPages.push(page);

    // Then create auto-tracked page
    const newPage = await browser.newPage();

    // Both pages should be tracked now
    expect(extraPages.length).toBe(2);
    expect(extraPages.pages).toContain(page);
    expect(extraPages.pages).toContain(newPage);
  });
});
