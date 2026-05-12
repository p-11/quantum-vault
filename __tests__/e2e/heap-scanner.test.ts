import { test, expect } from '@playwright/test';
import { checkSensitiveDataInHeap } from './heap-scanner';

/**
 * Leak Detection Verification (Validation Test)
 *
 * This test ensures that our memory scanner is functional.
 * It intentionally creates a leak and confirms that the scanner detects it.
 *
 * The test is designed to PASS only if the scanner correctly IDENTIFIES a leak.
 */
test.describe('Heap Scanner Verification @security', () => {
  test('scanner should correctly identify an intentional global leak', async ({
    page
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const secretLeak = 'VERIFICATION_LEAK_STRING_999';

    // 1. Create an intentional leak
    await page.evaluate(secret => {
      Reflect.set(window, 'EXPECTED_LEAK', secret);
    }, secretLeak);

    await expect(
      checkSensitiveDataInHeap({
        page,
        sensitiveDataSteps: [secretLeak],
        expectPresent: false
      })
    ).rejects.toThrow();
  });

  test('scanner should correctly identify an intentional Uint8Array leak', async ({
    page
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const secretBytes = new Uint8Array([
      0x51, 0x55, 0x41, 0x4e, 0x54, 0x55, 0x4d
    ]); // "QUANTUM"

    // 1. Create an intentional leak as a string
    await page.evaluate(bytes => {
      const decoded = new TextDecoder().decode(
        new Uint8Array(Object.values(bytes))
      );
      Reflect.set(window, 'BYTE_LEAK', decoded);
    }, secretBytes);

    await expect(
      checkSensitiveDataInHeap({
        page,
        sensitiveDataSteps: [secretBytes],
        expectPresent: false
      })
    ).rejects.toThrow();

    // Cleanup
    await page.evaluate(() => Reflect.deleteProperty(window, 'BYTE_LEAK'));
  });

  test('scanner should correctly confirm absence after cleanup', async ({
    page
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const secretTemp = 'TEMP_VERIFICATION_SECRET';

    // 1. Create and then immediately clear a leak
    await page.evaluate(secret => {
      Reflect.set(window, 'TEMP_LEAK', secret);
    }, secretTemp);

    // 2. Clear reference
    await page.evaluate(() => {
      Reflect.set(window, 'TEMP_LEAK', null);
      Reflect.deleteProperty(window, 'TEMP_LEAK');
    });

    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: [secretTemp],
      expectPresent: false
    });
  });
});
