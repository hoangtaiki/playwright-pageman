import { test, expect } from '../src/page-manager';

test.describe('ExtraContexts - Core Functionality', () => {
  test.describe('Push and Track', () => {
    test('should track a single context', async ({
      browser,
      extraContexts,
    }) => {
      const context = await browser.newContext();
      extraContexts.push(context);

      expect(extraContexts.length).toBe(1);
      expect(extraContexts.contexts).toHaveLength(1);
      expect(extraContexts.contexts[0]).toBe(context);
    });

    test('should track multiple contexts', async ({
      browser,
      extraContexts,
    }) => {
      const ctx1 = await browser.newContext();
      const ctx2 = await browser.newContext();
      extraContexts.push(ctx1, ctx2);

      expect(extraContexts.length).toBe(2);
    });

    test('should deduplicate same context pushed twice', async ({
      browser,
      extraContexts,
    }) => {
      const context = await browser.newContext();
      extraContexts.push(context);
      extraContexts.push(context);

      expect(extraContexts.length).toBe(1);
    });

    test('should start empty', async ({ extraContexts }) => {
      expect(extraContexts.length).toBe(0);
      expect(extraContexts.contexts).toHaveLength(0);
    });
  });

  test.describe('Remove', () => {
    test('should remove a tracked context', async ({
      browser,
      extraContexts,
    }) => {
      const context = await browser.newContext();
      extraContexts.push(context);

      const result = extraContexts.remove(context);
      expect(result).toBe(true);
      expect(extraContexts.length).toBe(0);

      await context.close();
    });

    test('should return false for untracked context', async ({
      browser,
      extraContexts,
    }) => {
      const context = await browser.newContext();
      const result = extraContexts.remove(context);
      expect(result).toBe(false);

      await context.close();
    });
  });

  test.describe('CloseAll', () => {
    test('should close all contexts and their pages', async ({
      browser,
      extraContexts,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraContexts.push(context);

      await extraContexts.closeAll();

      expect(extraContexts.length).toBe(0);
      expect(page.isClosed()).toBe(true);
    });

    test('should be a no-op when empty', async ({ extraContexts }) => {
      await expect(extraContexts.closeAll()).resolves.toBeUndefined();
    });

    test('should close multiple contexts', async ({
      browser,
      extraContexts,
    }) => {
      const ctx1 = await browser.newContext();
      const ctx2 = await browser.newContext();
      const ctx3 = await browser.newContext();

      extraContexts.push(ctx1, ctx2, ctx3);
      await extraContexts.closeAll();

      expect(extraContexts.length).toBe(0);
    });
  });

  test.describe('Combined with ExtraPages', () => {
    test('should work independently from extraPages', async ({
      browser,
      extraPages,
      extraContexts,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      extraPages.push(page);
      extraContexts.push(context);

      expect(extraPages.length).toBe(1);
      expect(extraContexts.length).toBe(1);
    });
  });

  test.describe('Isolation Between Tests', () => {
    test('first test tracks contexts', async ({ browser, extraContexts }) => {
      const context = await browser.newContext();
      extraContexts.push(context);
      expect(extraContexts.length).toBe(1);
    });

    test('second test starts with empty tracker', async ({ extraContexts }) => {
      expect(extraContexts.length).toBe(0);
    });
  });
});
