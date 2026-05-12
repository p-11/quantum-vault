import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import {
  completeStartupOnboarding,
  expectHomeVisible,
  readRecoveryPhraseRevealPageWords,
  resetClientStorage,
  TEST_USER_PASSWORD,
  unlockWalletIfPrompted,
  vaultLoadTimeoutMs
} from '../helpers';
import { installDeterministicRecoveryNetwork } from '../network-mocks';

const createWalletButtonName = /Create a Vault Account|Create a new wallet/i;
const ethereumVaultSelector = '[data-testid="vault-card"][data-address^="0x"]';
const bitcoinVaultSelector = '[data-testid="vault-card"][data-address^="bc1"]';

const startWalletCreationAtBackupPrompt = async (page: Page): Promise<void> => {
  await installDeterministicRecoveryNetwork({ page });
  await resetClientStorage(page);
  await completeStartupOnboarding(page);

  await page.getByRole('button', { name: createWalletButtonName }).click();
  await page.getByLabel('Password', { exact: true }).fill(TEST_USER_PASSWORD);
  await page.getByLabel('Confirm Password').fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('button', { name: 'Reveal Recovery Phrase' })
  ).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

const reopenPopup = async ({
  context,
  page
}: {
  context: BrowserContext;
  page: Page;
}): Promise<Page> => {
  await page.close();

  const reopenedPage = await context.newPage();
  await installDeterministicRecoveryNetwork({ page: reopenedPage });
  await reopenedPage.goto('/');
  return reopenedPage;
};

const expectDefaultVaultsVisible = async (page: Page): Promise<void> => {
  await expect(page.locator(ethereumVaultSelector).first()).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
  await expect(page.locator(bitcoinVaultSelector).first()).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

test.describe('wallet creation interruption repair @smoke @flows', () => {
  test('repairs password-present wallets closed before seed reveal', async ({
    context,
    page
  }) => {
    await startWalletCreationAtBackupPrompt(page);

    const reopenedPage = await reopenPopup({ context, page });
    await unlockWalletIfPrompted(reopenedPage, TEST_USER_PASSWORD);

    await expectHomeVisible(reopenedPage);
    await expectDefaultVaultsVisible(reopenedPage);
  });

  test('repairs wallets closed during seed reveal without showing phrase again', async ({
    context,
    page
  }) => {
    await startWalletCreationAtBackupPrompt(page);
    await page.getByRole('button', { name: 'Reveal Recovery Phrase' }).click();
    await expect(
      page.getByRole('button', { name: 'Click to Reveal' })
    ).toBeVisible({
      timeout: vaultLoadTimeoutMs
    });
    await page.getByRole('button', { name: 'Click to Reveal' }).click();

    const firstPageWords = await readRecoveryPhraseRevealPageWords({ page });
    expect(firstPageWords).toHaveLength(12);

    const reopenedPage = await reopenPopup({ context, page });
    await unlockWalletIfPrompted(reopenedPage, TEST_USER_PASSWORD);

    await expectHomeVisible(reopenedPage);
    await expectDefaultVaultsVisible(reopenedPage);
    await expect(reopenedPage.locator('body')).not.toContainText(
      `1. ${firstPageWords[0]}`
    );
  });

  test('repairs wallets closed immediately after requesting seed reveal', async ({
    context,
    page
  }) => {
    await startWalletCreationAtBackupPrompt(page);
    await page.getByRole('button', { name: 'Reveal Recovery Phrase' }).click();

    const reopenedPage = await reopenPopup({ context, page });
    await unlockWalletIfPrompted(reopenedPage, TEST_USER_PASSWORD);

    await expectHomeVisible(reopenedPage);
    await expectDefaultVaultsVisible(reopenedPage);
  });
});
