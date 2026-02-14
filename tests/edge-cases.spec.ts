import {
  test,
  expect,
  getExtraPages,
  getExtraContexts,
  extraPages,
} from '../src/page-manager';

test.describe('PageMan - Edge Cases', () => {
  test.describe('Already Closed Pages', () => {
    test('should handle page closed before cleanup', async ({
      browser,
      extraPages: fixture,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      fixture.push(page);

      await page.close();
      expect(page.isClosed()).toBe(true);

      // closeAll should not throw
      await expect(fixture.closeAll()).resolves.toBeUndefined();
      expect(fixture.length).toBe(0);

      await context.close();
    });

    test('should handle mix of open and closed pages', async ({
      browser,
      extraPages: fixture,
    }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      const page3 = await context.newPage();

      fixture.push(page1, page2, page3);

      // Close one manually
      await page2.close();

      await fixture.closeAll();

      expect(page1.isClosed()).toBe(true);
      expect(page2.isClosed()).toBe(true);
      expect(page3.isClosed()).toBe(true);
      expect(fixture.length).toBe(0);

      await context.close();
    });
  });

  test.describe('Context Closed Before Pages', () => {
    test('should handle context closed while pages still tracked', async ({
      browser,
      extraPages: fixture,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      fixture.push(page);

      // Close context first (which closes its pages)
      await context.close();
      expect(page.isClosed()).toBe(true);

      // Cleanup should handle gracefully
      await expect(fixture.closeAll()).resolves.toBeUndefined();
    });
  });

  test.describe('Empty Operations', () => {
    test('should handle closeAll on empty tracker', async ({
      extraPages: fixture,
    }) => {
      await expect(fixture.closeAll()).resolves.toBeUndefined();
    });

    test('should handle remove on empty tracker', async ({
      browser,
      extraPages: fixture,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      expect(fixture.remove(page)).toBe(false);

      await context.close();
    });

    test('should handle push with no arguments', async ({
      extraPages: fixture,
    }) => {
      fixture.push();
      expect(fixture.length).toBe(0);
    });
  });

  test.describe('Global Accessors', () => {
    test('getExtraPages should return current fixture', async ({
      browser,
      extraPages: fixture,
    }) => {
      const globalRef = getExtraPages();
      const context = await browser.newContext();
      const page = await context.newPage();

      globalRef.push(page);
      expect(fixture.length).toBe(1);
      expect(fixture.pages[0]).toBe(page);

      await context.close();
    });

    test('getExtraContexts should return current fixture', async ({
      browser,
      extraContexts: fixture,
    }) => {
      const globalRef = getExtraContexts();
      const context = await browser.newContext();

      globalRef.push(context);
      expect(fixture.length).toBe(1);
      expect(fixture.contexts[0]).toBe(context);
    });

    test('extraPages proxy should delegate to fixture', async ({
      browser,
      extraPages: fixture,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      extraPages.push(page);
      expect(fixture.length).toBe(1);

      await context.close();
    });

    test('proxy methods should maintain binding', async ({
      browser,
      extraPages: _fixture,
    }) => {
      const pushMethod = extraPages.push;
      const context = await browser.newContext();
      const page = await context.newPage();

      pushMethod(page);
      expect(extraPages.length).toBe(1);

      await context.close();
    });

    test('proxy should have all expected members', async ({
      extraPages: _fixture,
    }) => {
      expect(typeof extraPages.push).toBe('function');
      expect(typeof extraPages.remove).toBe('function');
      expect(typeof extraPages.closeAll).toBe('function');
      expect(typeof extraPages.length).toBe('number');
      expect(Array.isArray(extraPages.pages)).toBe(true);
    });
  });

  test.describe('Multiple Push Calls', () => {
    test('should accumulate pages across push calls', async ({
      browser,
      extraPages: fixture,
    }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      const page3 = await context.newPage();

      fixture.push(page1);
      fixture.push(page2);
      fixture.push(page3);

      expect(fixture.length).toBe(3);

      await context.close();
    });

    test('should handle push after closeAll', async ({
      browser,
      extraPages: fixture,
    }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      fixture.push(page1);

      await fixture.closeAll();
      expect(fixture.length).toBe(0);

      const page2 = await context.newPage();
      fixture.push(page2);
      expect(fixture.length).toBe(1);

      await context.close();
    });
  });

  test.describe('Test Failure Handling', () => {
    test('should still clean up on test failure', async ({
      browser,
      extraPages: fixture,
    }) => {
      test.fail();

      const context = await browser.newContext();
      const page = await context.newPage();
      fixture.push(page);

      // This will cause the test to fail,
      // but teardown should still run and close the page
      expect(1).toBe(2);
    });
  });
});
