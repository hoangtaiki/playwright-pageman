import { test, expect } from '../src/page-manager';

test.describe('PageMan - Configuration', () => {
  test.describe('logCleanup Option', () => {
    test('should log cleanup when logCleanup is true', async ({
      browser,
      extraPages,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!options?.logCleanup, 'Requires logCleanup: true');

      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await extraPages.closeAll();
        expect(capturedOutput).toContain('[pageman]');
        expect(capturedOutput).toContain('Closing');
        expect(capturedOutput).toContain('Successfully cleaned up');
      } finally {
        process.stdout.write = originalWrite;
      }

      await context.close();
    });

    test('should not log when logCleanup is false', async ({
      browser,
      extraPages,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!!options?.logCleanup, 'This test is for logCleanup: false');

      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await extraPages.closeAll();
        expect(capturedOutput).not.toContain('[pageman]');
      } finally {
        process.stdout.write = originalWrite;
      }

      await context.close();
    });
  });

  test.describe('closeTimeout Option', () => {
    test('should use default closeTimeout of 5000ms', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);

      // Close should succeed within default timeout
      await extraPages.closeAll();
      expect(page.isClosed()).toBe(true);

      await context.close();
    });
  });

  test.describe('Default Options', () => {
    test('should work with no configuration', async ({
      browser,
      extraPages,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      extraPages.push(page);

      expect(extraPages.length).toBe(1);
      await extraPages.closeAll();
      expect(extraPages.length).toBe(0);

      await context.close();
    });
  });
});
