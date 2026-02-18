import {
  test,
  expect,
  getExtraPages,
  getExtraContexts,
  extraPages,
  extraContexts,
} from '../src/index';

test.describe('PageMan - Error Handling', () => {
  test.describe('Page Close Errors with Logging', () => {
    test('should log error when page close fails with logCleanup enabled', async ({
      browser,
      extraPages: fixture,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!options?.logCleanup, 'Requires logCleanup: true');

      const context = await browser.newContext();
      const page = await context.newPage();

      // Mock page.close() to throw an error
      const originalClose = page.close.bind(page);
      let closeCalled = false;
      page.close = async () => {
        closeCalled = true;
        throw new Error('Simulated page close error');
      };

      fixture.push(page);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await fixture.closeAll();

        expect(closeCalled).toBe(true);
        expect(capturedOutput).toContain('[pageman]');
        expect(capturedOutput).toContain('Warning: failed to close page');
        expect(capturedOutput).toContain('Simulated page close error');
      } finally {
        process.stdout.write = originalWrite;
        // Restore and actually close the page
        page.close = originalClose;
        if (!page.isClosed()) {
          await page.close();
        }
      }

      await context.close();
    });

    test('should handle non-Error thrown during page close', async ({
      browser,
      extraPages: fixture,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!options?.logCleanup, 'Requires logCleanup: true');

      const context = await browser.newContext();
      const page = await context.newPage();

      // Mock page.close() to throw a non-Error value
      const originalClose = page.close.bind(page);
      page.close = async () => {
        throw 'String error instead of Error object';
      };

      fixture.push(page);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await fixture.closeAll();

        expect(capturedOutput).toContain('Warning: failed to close page');
        expect(capturedOutput).toContain(
          'String error instead of Error object'
        );
      } finally {
        process.stdout.write = originalWrite;
        page.close = originalClose;
        if (!page.isClosed()) {
          await page.close();
        }
      }

      await context.close();
    });

    test('should handle page close timeout', async ({
      browser,
      extraPages: fixture,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!options?.logCleanup, 'Requires logCleanup: true');
      test.skip(
        !options?.closeTimeout || options.closeTimeout > 1000,
        'Requires short closeTimeout for this test'
      );

      const context = await browser.newContext();
      const page = await context.newPage();

      // Mock page.close() to hang longer than timeout
      const originalClose = page.close.bind(page);
      page.close = async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
      };

      fixture.push(page);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await fixture.closeAll();

        expect(capturedOutput).toContain('Warning: failed to close page');
        expect(capturedOutput).toContain('timeout');
      } finally {
        process.stdout.write = originalWrite;
        page.close = originalClose;
        if (!page.isClosed()) {
          await page.close();
        }
      }

      await context.close();
    });
  });

  test.describe('Context Close Errors with Logging', () => {
    test('should log context close operations with logCleanup enabled', async ({
      browser,
      extraContexts: fixture,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!options?.logCleanup, 'Requires logCleanup: true');

      const context = await browser.newContext();
      fixture.push(context);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await fixture.closeAll();

        expect(capturedOutput).toContain('[pageman]');
        expect(capturedOutput).toContain('Closing 1 tracked context(s)');
        expect(capturedOutput).toContain(
          'Successfully cleaned up 1 context(s)'
        );
      } finally {
        process.stdout.write = originalWrite;
      }
    });

    test('should log error when context close fails', async ({
      browser,
      extraContexts: fixture,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!options?.logCleanup, 'Requires logCleanup: true');

      const context = await browser.newContext();

      // Mock context.close() to throw an error
      const originalClose = context.close.bind(context);
      let closeCalled = false;
      context.close = async () => {
        closeCalled = true;
        throw new Error('Simulated context close error');
      };

      fixture.push(context);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await fixture.closeAll();

        expect(closeCalled).toBe(true);
        expect(capturedOutput).toContain('[pageman]');
        expect(capturedOutput).toContain('Warning: failed to close context');
        expect(capturedOutput).toContain('Simulated context close error');
      } finally {
        process.stdout.write = originalWrite;
        context.close = originalClose;
        await context.close();
      }
    });

    test('should handle non-Error thrown during context close', async ({
      browser,
      extraContexts: fixture,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!options?.logCleanup, 'Requires logCleanup: true');

      const context = await browser.newContext();

      // Mock context.close() to throw a non-Error value
      const originalClose = context.close.bind(context);
      context.close = async () => {
        throw 42; // Throw a number instead of Error
      };

      fixture.push(context);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await fixture.closeAll();

        expect(capturedOutput).toContain('Warning: failed to close context');
        expect(capturedOutput).toContain('42');
      } finally {
        process.stdout.write = originalWrite;
        context.close = originalClose;
        await context.close();
      }
    });

    test('should handle context close timeout', async ({
      browser,
      extraContexts: fixture,
    }) => {
      const options = (test.info().project.use as any)?.pageManOptions;
      test.skip(!options?.logCleanup, 'Requires logCleanup: true');
      test.skip(
        !options?.closeTimeout || options.closeTimeout > 1000,
        'Requires short closeTimeout for this test'
      );

      const context = await browser.newContext();

      // Mock context.close() to hang longer than timeout
      const originalClose = context.close.bind(context);
      context.close = async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
      };

      fixture.push(context);

      let capturedOutput = '';
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: any): boolean => {
        capturedOutput += String(chunk);
        return originalWrite(chunk);
      }) as typeof process.stdout.write;

      try {
        await fixture.closeAll();

        expect(capturedOutput).toContain('Warning: failed to close context');
        expect(capturedOutput).toContain('timeout');
      } finally {
        process.stdout.write = originalWrite;
        context.close = originalClose;
        await context.close();
      }
    });
  });

  test.describe('Global Accessor Errors', () => {
    test('should verify global accessors work within test context', async ({
      extraPages: _pagesFixture,
      extraContexts: _contextsFixture,
    }) => {
      // Note: Testing "outside test context" is challenging within Playwright's
      // test framework since we're always in a test context. The error handling
      // in assertExtraPagesActive() and assertExtraContextsActive() is designed
      // to throw when currentExtraPages/currentExtraContexts are null, which
      // happens before fixture setup and after fixture teardown.

      // This test ensures the global accessors work correctly when properly
      // used within a test context with both fixtures active
      expect(() => getExtraPages()).not.toThrow();
      expect(() => getExtraContexts()).not.toThrow();
      expect(() => extraPages.length).not.toThrow();
      expect(() => extraContexts.length).not.toThrow();

      // Verify they return the correct fixture instances
      expect(getExtraPages().length).toBe(0);
      expect(getExtraContexts().length).toBe(0);
    });
  });

  test.describe('ExtraContexts Proxy Functionality', () => {
    test('extraContexts proxy should delegate push to fixture', async ({
      browser,
      extraContexts: fixture,
    }) => {
      const context = await browser.newContext();

      extraContexts.push(context);
      expect(fixture.length).toBe(1);
      expect(fixture.contexts[0]).toBe(context);
    });

    test('extraContexts proxy methods should maintain binding', async ({
      browser,
      extraContexts: _fixture,
    }) => {
      const pushMethod = extraContexts.push;
      const context = await browser.newContext();

      pushMethod(context);
      expect(extraContexts.length).toBe(1);
    });

    test('extraContexts proxy should have all expected members', async ({
      extraContexts: _fixture,
    }) => {
      expect(typeof extraContexts.push).toBe('function');
      expect(typeof extraContexts.remove).toBe('function');
      expect(typeof extraContexts.closeAll).toBe('function');
      expect(typeof extraContexts.length).toBe('number');
      expect(Array.isArray(extraContexts.contexts)).toBe(true);
    });

    test('extraContexts proxy should access length property', async ({
      browser,
      extraContexts: _fixture,
    }) => {
      const ctx1 = await browser.newContext();
      const ctx2 = await browser.newContext();

      extraContexts.push(ctx1, ctx2);
      expect(extraContexts.length).toBe(2);
    });

    test('extraContexts proxy should access contexts property', async ({
      browser,
      extraContexts: _fixture,
    }) => {
      const context = await browser.newContext();

      extraContexts.push(context);
      expect(extraContexts.contexts).toHaveLength(1);
      expect(extraContexts.contexts[0]).toBe(context);
    });

    test('extraContexts proxy should call remove method', async ({
      browser,
      extraContexts: _fixture,
    }) => {
      const context = await browser.newContext();

      extraContexts.push(context);
      expect(extraContexts.length).toBe(1);

      const result = extraContexts.remove(context);
      expect(result).toBe(true);
      expect(extraContexts.length).toBe(0);

      await context.close();
    });

    test('extraContexts proxy should call closeAll method', async ({
      browser,
      extraContexts: _fixture,
    }) => {
      const context = await browser.newContext();
      extraContexts.push(context);

      await extraContexts.closeAll();
      expect(extraContexts.length).toBe(0);
    });
  });
});
