import { test, expect } from '../src/index';

test.describe('ExtraPages - Core Functionality', () => {
  test.describe('Push and Track', () => {
    test('should track a single page', async ({ browser, extraPages }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);

      expect(extraPages.length).toBe(1);
      expect(extraPages.pages).toHaveLength(1);
      expect(extraPages.pages[0]).toBe(page);

      await context.close();
    });

    test('should track multiple pages via single push', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      extraPages.push(page1, page2);

      expect(extraPages.length).toBe(2);

      await context.close();
    });

    test('should deduplicate same page pushed twice', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);
      extraPages.push(page);

      expect(extraPages.length).toBe(1);

      await context.close();
    });

    test('should start empty', async ({ extraPages }) => {
      expect(extraPages.length).toBe(0);
      expect(extraPages.pages).toHaveLength(0);
    });

    test('should return readonly copy from pages getter', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);

      const snapshot1 = extraPages.pages;
      const snapshot2 = extraPages.pages;
      expect(snapshot1).not.toBe(snapshot2); // Different array references
      expect(snapshot1).toEqual(snapshot2); // Same contents

      await context.close();
    });
  });

  test.describe('Remove', () => {
    test('should remove a tracked page', async ({ browser, extraPages }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);

      const result = extraPages.remove(page);
      expect(result).toBe(true);
      expect(extraPages.length).toBe(0);

      await page.close();
      await context.close();
    });

    test('should return false for untracked page', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      const result = extraPages.remove(page);
      expect(result).toBe(false);

      await context.close();
    });
  });

  test.describe('Auto-Cleanup on Teardown', () => {
    test('should auto-close tracked pages after test', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      extraPages.push(page1, page2);

      // Pages are open during the test
      expect(page1.isClosed()).toBe(false);
      expect(page2.isClosed()).toBe(false);

      // Teardown will close them after use() returns
    });

    test('should handle already-closed pages gracefully', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);

      // Close the page before teardown
      await page.close();
      expect(page.isClosed()).toBe(true);

      // Teardown should not throw
    });
  });

  test.describe('CloseAll - Explicit', () => {
    test('should close all pages immediately', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      extraPages.push(page1, page2);

      await extraPages.closeAll();

      expect(extraPages.length).toBe(0);
      expect(page1.isClosed()).toBe(true);
      expect(page2.isClosed()).toBe(true);

      await context.close();
    });

    test('should be a no-op when no pages tracked', async ({ extraPages }) => {
      await expect(extraPages.closeAll()).resolves.toBeUndefined();
      expect(extraPages.length).toBe(0);
    });

    test('should close all tracked pages', async ({ browser, extraPages }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      const page3 = await context.newPage();

      extraPages.push(page1, page2, page3);
      await extraPages.closeAll();

      expect(page1.isClosed()).toBe(true);
      expect(page2.isClosed()).toBe(true);
      expect(page3.isClosed()).toBe(true);

      await context.close();
    });
  });

  test.describe('Isolation Between Tests', () => {
    test('first test tracks pages', async ({ browser, extraPages }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);
      expect(extraPages.length).toBe(1);
      await context.close();
    });

    test('second test starts with empty tracker', async ({ extraPages }) => {
      // Each test gets a fresh fixture instance
      expect(extraPages.length).toBe(0);
    });
  });
});
