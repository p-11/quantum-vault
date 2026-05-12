import { expect, test } from '@playwright/test';

import { vaultAlertCopy, vaultDetailCopy, vaultSuccessCopy } from '@/lib/copy';

import { fundAccountWithEth } from '../../test-utils';

import {
  clickActiveBackButton,
  expectCurrencyOptionChecked,
  expectHomeVisible,
  expectRootScreenshot,
  expectSettingsScreenVisible,
  expectUnifiedHomeSectionOrder,
  createWalletAndOpenHome,
  completeExternalEthereumWithdraw,
  getPrimaryEthereumAddress,
  installDeterministicBitcoinReadMocks,
  openExportKeysPasswordGate,
  openBitcoinVaultDetail,
  openEthereumVaultDetail,
  openReceiveScreen,
  openSettingsScreen,
  openSettingsSubScreen,
  openWithdrawDestinationStep,
  prepareVisualRegressionCapture,
  recoverWalletAndOpenHome,
  reloadAndUnlockIfNeeded,
  returnFromExportKeysToSettings,
  settingsButtonName,
  TEST_USER_PASSWORD,
  VALID_EVM_ADDRESS
} from '../helpers';

test.describe('vault visual regression matrix @flows', () => {
  test.skip(
    process.env.CI === 'true',
    'Visual snapshots currently only have local Darwin baselines.'
  );
  test.describe.configure({ mode: 'serial' });

  test.use({
    viewport: {
      width: 360,
      height: 600
    }
  });

  test('captures deterministic home and vault detail states', async ({
    page
  }) => {
    await recoverWalletAndOpenHome({ page });
    await prepareVisualRegressionCapture(page);

    await expectHomeVisible(page);
    await expectUnifiedHomeSectionOrder(page);
    await expect(page.locator('[data-testid^="home-section-"]')).toHaveCount(2);

    await expectRootScreenshot({
      page,
      name: 'eng-1719-home-vaults-and-alerts.png'
    });

    await openBitcoinVaultDetail(page);
    await expectRootScreenshot({
      page,
      name: 'eng-1719-vault-btc-funds.png'
    });

    await page.getByTestId('tab-activity').click();
    await expectRootScreenshot({
      page,
      name: 'eng-1719-vault-btc-activity.png'
    });
  });

  test('captures ENG-1808 settings redesign states', async ({ page }) => {
    await createWalletAndOpenHome({ page });
    await prepareVisualRegressionCapture(page);

    await openSettingsScreen(page);
    await expectRootScreenshot({
      page,
      name: 'eng-1808-settings-main.png'
    });

    await openSettingsSubScreen({
      page,
      actionName: settingsButtonName.changeCurrency,
      screenName: 'Currency'
    });
    await expectCurrencyOptionChecked({ page, currencyCode: 'usd' });
    await expectRootScreenshot({
      page,
      name: 'eng-1808-settings-currency.png'
    });

    await clickActiveBackButton(page);
    await expectSettingsScreenVisible(page);

    await openSettingsSubScreen({
      page,
      actionName: settingsButtonName.lockWallet,
      screenName: 'Lock Wallet'
    });
    await expectRootScreenshot({
      page,
      name: 'eng-1808-settings-lock-wallet.png'
    });

    await clickActiveBackButton(page);
    await expectSettingsScreenVisible(page);

    await openExportKeysPasswordGate(page);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expectRootScreenshot({
      page,
      name: 'eng-1808-settings-export-keys-password.png'
    });

    await page.getByLabel('Password', { exact: true }).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /^Continue$/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Export Keys' })
    ).toBeVisible();
    await page
      .getByRole('button', { name: settingsButtonName.revealKeys })
      .click();
    await expectRootScreenshot({
      page,
      name: 'eng-1808-settings-export-keys-reveal-page-one.png'
    });

    await page.getByRole('button', { name: /^NEXT$/i }).click();
    await expect(
      page.getByRole('button', { name: settingsButtonName.copy })
    ).toBeVisible();
    await expectRootScreenshot({
      page,
      name: 'eng-1808-settings-export-keys-reveal-page-two.png'
    });

    await returnFromExportKeysToSettings(page);

    await openSettingsSubScreen({
      page,
      actionName: settingsButtonName.deleteQuantumVault,
      screenName: 'Delete Quantum Vault'
    });
    await expectRootScreenshot({
      page,
      name: 'eng-1808-settings-delete-quantum-vault.png'
    });
  });

  test('captures deterministic withdraw suggestion and deposit states', async ({
    page
  }) => {
    await recoverWalletAndOpenHome({ page });
    await prepareVisualRegressionCapture(page);

    await openReceiveScreen(page);
    await expectRootScreenshot({
      page,
      name: 'eng-1719-home-vaults-safe-deposit.png'
    });

    await page.getByTestId('back-button').click();
    await expectHomeVisible(page);

    await openBitcoinVaultDetail(page);

    await openWithdrawDestinationStep(page);
    await expectRootScreenshot({
      page,
      name: 'eng-1719-safe-withdraw-add-address.png'
    });

    await page.getByTestId('destination-address-input').fill(VALID_EVM_ADDRESS);
    await page
      .locator('[data-testid="continue-button"][data-step="destination"]')
      .click();

    await expect(page.getByTestId('withdraw-step-review')).toBeVisible();
    await expectRootScreenshot({
      page,
      name: 'eng-1719-safe-withdraw-review-yes.png'
    });

    await page.getByTestId('withdraw-review-cancel-button').click();
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeVisible();
  });

  test('captures deterministic withdrawn funds and activity states', async ({
    page
  }) => {
    await installDeterministicBitcoinReadMocks(page);
    await createWalletAndOpenHome({ page, withDeterministicNetwork: false });

    const ethereumAddress = await getPrimaryEthereumAddress(page);
    await fundAccountWithEth(ethereumAddress);

    await reloadAndUnlockIfNeeded(page);
    await openEthereumVaultDetail(page, { address: ethereumAddress });
    await prepareVisualRegressionCapture(page);

    await completeExternalEthereumWithdraw({
      page,
      onRetry: async () => {
        await fundAccountWithEth(ethereumAddress);
        await reloadAndUnlockIfNeeded(page);
        await openEthereumVaultDetail(page, { address: ethereumAddress });
      }
    });

    await expect(page.getByTestId('vault-lifecycle-banner')).toHaveAttribute(
      'data-lifecycle-kind',
      'withdrawn'
    );
    await expect(page.getByTestId('vault-lifecycle-banner')).toContainText(
      vaultAlertCopy.withdrawnBody
    );
    await expect(page.getByText(vaultSuccessCopy.title)).toBeVisible();
    await expect(page.getByText(vaultDetailCopy.withdrawnBadge)).toBeVisible();
    const viewWithdrawalTxButton = page
      .getByTestId('vault-detail-funds-state-withdrawn')
      .getByTestId('vault-detail-funds-view-tx-button');
    await viewWithdrawalTxButton.scrollIntoViewIfNeeded();
    await expect(viewWithdrawalTxButton).toBeInViewport({ ratio: 1 });
    await expect(viewWithdrawalTxButton).toBeEnabled();

    await expectRootScreenshot({
      page,
      name: 'eng-1717-vault-withdrawn-funds.png'
    });

    await page.getByTestId('tab-activity').click();

    await expect(page.getByTestId('vault-lifecycle-banner')).toHaveAttribute(
      'data-lifecycle-kind',
      'withdrawn'
    );
    await expect(page.getByTestId('vault-lifecycle-banner')).toContainText(
      vaultAlertCopy.withdrawnBody
    );
    await expect(
      page.getByText(vaultDetailCopy.activityDirectionWithdrawAll).first()
    ).toBeVisible();
    await expect(
      page.getByText(vaultDetailCopy.activityAllFunds).first()
    ).toBeVisible();

    await expectRootScreenshot({
      page,
      name: 'eng-1717-vault-withdrawn-activity.png'
    });
  });

  test('keeps withdraw review disabled when no funds are available', async ({
    page
  }) => {
    await recoverWalletAndOpenHome({ page });
    await prepareVisualRegressionCapture(page);

    await openBitcoinVaultDetail(page);
    await openWithdrawDestinationStep(page);

    await page
      .getByTestId('destination-address-input')
      .fill('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
    await page
      .locator('[data-testid="continue-button"][data-step="destination"]')
      .click();

    await expect(page.getByTestId('confirm-withdraw-button')).toBeDisabled();
    await expectRootScreenshot({
      page,
      name: 'eng-1719-withdraw-review-no-funds.png'
    });
  });
});
