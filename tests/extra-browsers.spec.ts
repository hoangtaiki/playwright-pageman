import { test, expect, getExtraBrowsers, extraBrowsers } from '../src/index';
import { chromium, webkit } from '@playwright/test';

test.describe('ExtraBrowsers - Core Functionality', () => {
  test.describe('Push and Track', () => {
    test('should track a single browser', async ({ extraBrowsers }) => {
      const browser = await chromium.launch();
      extraBrowsers.push(browser);

      expect(extraBrowsers.length).toBe(1);
      expect(extraBrowsers.browsers).toHaveLength(1);
      expect(extraBrowsers.browsers[0]).toBe(browser);
    });

    test('should track multiple browsers', async ({ extraBrowsers }) => {
      const b1 = await chromium.launch();
      const b2 = await chromium.launch();
      extraBrowsers.push(b1, b2);

      expect(extraBrowsers.length).toBe(2);
    });

    test('should deduplicate same browser pushed twice', async ({
      extraBrowsers,
    }) => {
      const browser = await chromium.launch();
      extraBrowsers.push(browser);
      extraBrowsers.push(browser);

      expect(extraBrowsers.length).toBe(1);
    });

    test('should start empty', async ({ extraBrowsers }) => {
      expect(extraBrowsers.length).toBe(0);
      expect(extraBrowsers.browsers).toHaveLength(0);
    });
  });

  test.describe('Remove', () => {
    test('should remove a tracked browser', async ({ extraBrowsers }) => {
      const browser = await chromium.launch();
      extraBrowsers.push(browser);

      const result = extraBrowsers.remove(browser);
      expect(result).toBe(true);
      expect(extraBrowsers.length).toBe(0);

      await browser.close();
    });

    test('should return false for untracked browser', async ({
      extraBrowsers,
    }) => {
      const browser = await chromium.launch();
      const result = extraBrowsers.remove(browser);
      expect(result).toBe(false);

      await browser.close();
    });
  });

  test.describe('CloseAll', () => {
    test('should close all browsers', async ({ extraBrowsers }) => {
      const browser = await chromium.launch();
      extraBrowsers.push(browser);

      await extraBrowsers.closeAll();

      expect(extraBrowsers.length).toBe(0);
      expect(browser.isConnected()).toBe(false);
    });

    test('should be a no-op when empty', async ({ extraBrowsers }) => {
      await expect(extraBrowsers.closeAll()).resolves.toBeUndefined();
    });

    test('should close multiple browsers', async ({ extraBrowsers }) => {
      const b1 = await chromium.launch();
      const b2 = await chromium.launch();
      const b3 = await chromium.launch();

      extraBrowsers.push(b1, b2, b3);
      await extraBrowsers.closeAll();

      expect(extraBrowsers.length).toBe(0);
      expect(b1.isConnected()).toBe(false);
      expect(b2.isConnected()).toBe(false);
      expect(b3.isConnected()).toBe(false);
    });
  });

  test.describe('Global Accessor', () => {
    test('getExtraBrowsers returns the active fixture', async ({
      extraBrowsers,
    }) => {
      const browser = await chromium.launch();
      extraBrowsers.push(browser);

      expect(getExtraBrowsers().length).toBe(1);
      expect(getExtraBrowsers().browsers[0]).toBe(browser);
    });
  });

  test.describe('ExtraBrowsers Proxy Functionality', () => {
    test('extraBrowsers proxy should delegate push to fixture', async ({
      extraBrowsers: fixture,
    }) => {
      const browser = await chromium.launch();

      extraBrowsers.push(browser);
      expect(fixture.length).toBe(1);
      expect(fixture.browsers[0]).toBe(browser);
    });

    test('extraBrowsers proxy methods should maintain binding', async ({
      extraBrowsers: _fixture,
    }) => {
      const pushMethod = extraBrowsers.push;
      const browser = await chromium.launch();

      pushMethod(browser);
      expect(extraBrowsers.length).toBe(1);
    });

    test('extraBrowsers proxy should have all expected members', async ({
      extraBrowsers: _fixture,
    }) => {
      expect(typeof extraBrowsers.push).toBe('function');
      expect(typeof extraBrowsers.remove).toBe('function');
      expect(typeof extraBrowsers.closeAll).toBe('function');
      expect(typeof extraBrowsers.length).toBe('number');
      expect(Array.isArray(extraBrowsers.browsers)).toBe(true);
    });

    test('extraBrowsers proxy should access length property', async ({
      extraBrowsers: _fixture,
    }) => {
      const b1 = await chromium.launch();
      const b2 = await chromium.launch();

      extraBrowsers.push(b1, b2);
      expect(extraBrowsers.length).toBe(2);
    });

    test('extraBrowsers proxy should call remove method', async ({
      extraBrowsers: _fixture,
    }) => {
      const browser = await chromium.launch();

      extraBrowsers.push(browser);
      expect(extraBrowsers.length).toBe(1);

      const result = extraBrowsers.remove(browser);
      expect(result).toBe(true);
      expect(extraBrowsers.length).toBe(0);

      await browser.close();
    });

    test('extraBrowsers proxy should call closeAll method', async ({
      extraBrowsers: _fixture,
    }) => {
      const browser = await chromium.launch();
      extraBrowsers.push(browser);

      await extraBrowsers.closeAll();
      expect(extraBrowsers.length).toBe(0);
      expect(browser.isConnected()).toBe(false);
    });
  });

  test.describe('Cross-Engine', () => {
    test('should track and close browsers from different engines', async ({
      extraBrowsers,
    }) => {
      const chrome = await chromium.launch();
      const safari = await webkit.launch();
      extraBrowsers.push(chrome, safari);

      const chromePage = await (await chrome.newContext()).newPage();
      const safariPage = await (await safari.newContext()).newPage();

      expect(chrome.isConnected()).toBe(true);
      expect(safari.isConnected()).toBe(true);
      expect(chromePage.isClosed()).toBe(false);
      expect(safariPage.isClosed()).toBe(false);

      await extraBrowsers.closeAll();

      expect(extraBrowsers.length).toBe(0);
      expect(chrome.isConnected()).toBe(false);
      expect(safari.isConnected()).toBe(false);
    });
  });

  test.describe('Combined with other trackers', () => {
    test('should work independently from extraPages and extraContexts', async ({
      browser,
      extraPages,
      extraContexts,
      extraBrowsers,
    }) => {
      const launched = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      extraBrowsers.push(launched);
      extraContexts.push(context);
      extraPages.push(page);

      expect(extraBrowsers.length).toBe(1);
      expect(extraContexts.length).toBe(1);
      expect(extraPages.length).toBe(1);
    });
  });

  test.describe('Isolation Between Tests', () => {
    test('first test tracks browsers', async ({ extraBrowsers }) => {
      const browser = await chromium.launch();
      extraBrowsers.push(browser);
      expect(extraBrowsers.length).toBe(1);
    });

    test('second test starts with empty tracker', async ({ extraBrowsers }) => {
      expect(extraBrowsers.length).toBe(0);
    });
  });

  test.describe('Global Accessor Errors', () => {
    // These tests intentionally do NOT use the extraBrowsers fixture, so the
    // module-level accessor is null and the guard should throw.
    test('getExtraBrowsers throws when accessed without the fixture', () => {
      expect(() => getExtraBrowsers()).toThrow(
        /extraBrowsers was accessed outside/
      );
    });

    test('extraBrowsers proxy throws when accessed without the fixture', () => {
      expect(() => extraBrowsers.length).toThrow(
        /extraBrowsers was accessed outside/
      );
    });
  });
});
