import { expect, test } from '@playwright/test';

import {
  completeStartupOnboarding,
  pasteRecoveryPhraseInput,
  resetClientStorage,
  TEST_RECOVERY_MNEMONIC
} from '../helpers';
import { installDeterministicRecoveryNetwork } from '../network-mocks';

const openRecoveryStart = async (
  page: import('@playwright/test').Page
): Promise<void> => {
  const recoveryButton = page.getByRole('button', {
    name: /Recover a Vault Account|I already have one/i
  });
  const skipButton = page.getByRole('button', { name: 'Skip' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await recoveryButton.isVisible()) {
      await recoveryButton.click();
      return;
    }

    await skipButton.click({ timeout: 1500 }).catch(() => undefined);
  }

  await recoveryButton.click();
};

const openRecoveryPasswordStep = async ({
  page
}: {
  page: import('@playwright/test').Page;
}): Promise<void> => {
  await installDeterministicRecoveryNetwork({ page });
  await resetClientStorage(page);
  await completeStartupOnboarding(page);
  await openRecoveryStart(page);
  await pasteRecoveryPhraseInput({ page, phrase: TEST_RECOVERY_MNEMONIC });
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm Password')).toBeVisible();
};

test.describe('password validation flows @flows', () => {
  test.beforeEach(async ({ page }) => {
    await openRecoveryPasswordStep({ page });
  });

  test('shows password requirement errors only after blur', async ({
    page
  }) => {
    const passwordInput = page.getByLabel('Password', { exact: true });
    const confirmInput = page.getByLabel('Confirm Password');
    const minLengthError = page.getByText(
      'Password is too short. Use at least 8 characters.'
    );

    await passwordInput.fill('abc');
    await expect(minLengthError).toHaveCount(0);

    await confirmInput.click();
    await expect(minLengthError).toBeVisible();

    await passwordInput.fill('ValidPass123!');
    await expect(minLengthError).toHaveCount(0);

    await confirmInput.click();
    await expect(minLengthError).toHaveCount(0);
  });

  test('shows confirmation mismatch only after blur', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true });
    const confirmInput = page.getByLabel('Confirm Password');
    const mismatchError = page.getByText('Passwords do not match.');

    await passwordInput.fill('ValidPass123!');
    await confirmInput.fill('Different123!');
    await expect(mismatchError).toHaveCount(0);

    await passwordInput.click();
    await expect(mismatchError).toBeVisible();

    await confirmInput.fill('ValidPass123!');
    await passwordInput.click();
    await expect(mismatchError).toHaveCount(0);
  });
});
