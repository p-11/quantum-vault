import { expect, test, type Page } from '@playwright/test';

import { vaultDetailInsufficientWithdrawCopyByNamespace } from '@/lib/copy';

import {
  drainAccount,
  fundAccountWithEth,
  fundAccountWithTinyEth
} from '../../test-utils';
import {
  completeExternalEthereumWithdraw,
  createWalletAndOpenHome,
  expectAddressToAppearInHomeSection,
  expectHomeVisible,
  getPrimaryBitcoinAddress,
  getPrimaryEthereumAddress,
  installDeterministicBitcoinReadMocks,
  navigateBackToHome,
  openBitcoinVaultDetail,
  openEthereumVaultDetail,
  openReceiveScreen,
  openWithdrawDestinationStep,
  openWithdrawFlowStep,
  receiveAccountOptionByAddress,
  receiveSelectedAddressByAddress,
  reloadAndUnlockIfNeeded,
  VALID_EVM_ADDRESS,
  vaultLoadTimeoutMs
} from '../helpers';

const belowEthThresholdInlineMessage =
  vaultDetailInsufficientWithdrawCopyByNamespace.eip155;
const belowBtcThresholdInlineMessage =
  vaultDetailInsufficientWithdrawCopyByNamespace.bip122;
const bitcoinWithdrawThresholdSats = 900;

const completeExternalEthereumWithdrawAndReturnHome = async ({
  page,
  sourceAddress
}: {
  page: Page;
  sourceAddress: string;
}): Promise<void> => {
  await completeExternalEthereumWithdraw({
    page,
    onRetry: async () => {
      await fundAccountWithEth(sourceAddress);
      await reloadAndUnlockIfNeeded(page);
      await openEthereumVaultDetail(page, { address: sourceAddress });
    }
  });
  await expect(page.getByTestId('vault-lifecycle-banner')).toHaveAttribute(
    'data-lifecycle-kind',
    'withdrawn'
  );

  await page.getByTestId('vault-detail-back-button').click();
  await expectHomeVisible(page);
};

const expectWithdrawnEthereumAddressExcludedFromDeposit = async ({
  page,
  withdrawnAddress
}: {
  page: Page;
  withdrawnAddress: string;
}): Promise<void> => {
  await openReceiveScreen(page);
  await page.getByRole('button', { name: 'Ethereum' }).first().click();

  await expect(
    page
      .getByTestId('receive-account-selection')
      .or(page.getByTestId('receive-address-view'))
      .first()
  ).toBeVisible({ timeout: vaultLoadTimeoutMs });
  await expect(
    receiveAccountOptionByAddress(page, withdrawnAddress)
  ).toHaveCount(0);

  const accountOptions = page.getByTestId('receive-account-option');
  if ((await accountOptions.count()) > 0) {
    await accountOptions.first().click();
  }

  await expect(page.getByTestId('receive-selected-address')).toBeVisible();
  await expect(
    receiveSelectedAddressByAddress(page, withdrawnAddress)
  ).toHaveCount(0);

  await navigateBackToHome(page);
};

test.describe('withdraw flows @flows', () => {
  test('cancel exits withdraw flow from destination step', async ({ page }) => {
    await installDeterministicBitcoinReadMocks(page);
    await createWalletAndOpenHome({ page, withDeterministicNetwork: false });

    const ethereumAddress = await getPrimaryEthereumAddress(page);
    await fundAccountWithEth(ethereumAddress);
    await reloadAndUnlockIfNeeded(page);
    await openEthereumVaultDetail(page, { address: ethereumAddress });
    await openWithdrawDestinationStep(page);
    await page.getByTestId('withdraw-add-address-cancel-button').click();
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeVisible();
    await expect(page.getByTestId('vault-detail-back-button')).toBeVisible();
    await page.getByTestId('vault-detail-back-button').click();
    await expectHomeVisible(page);
  });

  test('supports suggestion yes/no branching with symmetric back transitions', async ({
    page
  }) => {
    await installDeterministicBitcoinReadMocks(page);
    await createWalletAndOpenHome({ page, withDeterministicNetwork: false });

    const ethereumAddress = await getPrimaryEthereumAddress(page);
    await fundAccountWithEth(ethereumAddress);

    await reloadAndUnlockIfNeeded(page);
    await openEthereumVaultDetail(page);

    await completeExternalEthereumWithdrawAndReturnHome({
      page,
      sourceAddress: ethereumAddress
    });
    await fundAccountWithEth(ethereumAddress);
    await reloadAndUnlockIfNeeded(page);
    await expectHomeVisible(page);
    await openEthereumVaultDetail(page, { address: ethereumAddress });

    await openWithdrawFlowStep({ page, path: 'suggested' });
    await expect(page.getByTestId('confirm-withdraw-button')).toHaveText(
      'CONFIRM'
    );

    await page.getByTestId('withdraw-back-button').click();
    await expect(page.getByTestId('withdraw-suggestion-step')).toBeVisible();

    await page.getByTestId('withdraw-suggestion-no-button').click();
    await expect(page.getByTestId('withdraw-step-destination')).toBeVisible();

    await page.getByTestId('withdraw-back-button').click();
    await expect(page.getByTestId('withdraw-suggestion-step')).toBeVisible();

    await page.getByTestId('withdraw-back-button').click();
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeVisible();
    await expect(page.getByTestId('vault-detail-back-button')).toBeVisible();
  });

  test('shows failure when funds are drained before confirm', async ({
    page
  }) => {
    await installDeterministicBitcoinReadMocks(page);
    await createWalletAndOpenHome({ page, withDeterministicNetwork: false });

    const ethereumAddress = await getPrimaryEthereumAddress(page);

    await fundAccountWithEth(ethereumAddress);
    await reloadAndUnlockIfNeeded(page);

    await openEthereumVaultDetail(page);
    await openWithdrawDestinationStep(page);

    await page.getByTestId('destination-address-input').fill(VALID_EVM_ADDRESS);
    await page
      .locator('[data-testid="continue-button"][data-step="destination"]')
      .click();

    await expect(page.getByTestId('confirm-withdraw-button')).toHaveText(
      'CONFIRM WITHDRAWAL'
    );
    await expect(page.getByTestId('confirm-withdraw-button')).toBeEnabled();
    await drainAccount(ethereumAddress);

    await page.getByTestId('confirm-withdraw-button').click();

    await expect(page.getByText('Withdrawal Failed')).toBeVisible();
    await expect(
      page.getByText('This vault has no assets available to withdraw.')
    ).toBeVisible();
  });

  test('applies ETH withdraw availability thresholds with inline message', async ({
    page
  }) => {
    await installDeterministicBitcoinReadMocks(page);
    await createWalletAndOpenHome({ page, withDeterministicNetwork: false });

    const ethereumAddress = await getPrimaryEthereumAddress(page);

    await fundAccountWithTinyEth(ethereumAddress);
    await reloadAndUnlockIfNeeded(page);
    await openEthereumVaultDetail(page, {
      address: ethereumAddress,
      withdrawButtonExpectation: 'visible'
    });
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeDisabled();
    await expect(page.getByText(belowEthThresholdInlineMessage)).toBeVisible();
    await page.getByTestId('vault-detail-back-button').click();
    await expectHomeVisible(page);

    await fundAccountWithEth(ethereumAddress);
    await reloadAndUnlockIfNeeded(page);
    await openEthereumVaultDetail(page, {
      address: ethereumAddress,
      withdrawButtonExpectation: 'visible'
    });
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeEnabled();
    await expect(page.getByText(belowEthThresholdInlineMessage)).toHaveCount(0);
    await openWithdrawDestinationStep(page);
    await page.getByTestId('withdraw-add-address-cancel-button').click();
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeVisible();
    await page.getByTestId('vault-detail-back-button').click();
    await expectHomeVisible(page);

    await drainAccount(ethereumAddress);
    await reloadAndUnlockIfNeeded(page);
    await openEthereumVaultDetail(page, {
      address: ethereumAddress,
      withdrawButtonExpectation: 'hidden'
    });
    await expect(page.getByTestId('vault-detail-withdraw-button')).toBeHidden();
  });

  test('persists withdrawn lifecycle banner after successful withdraw and reopen', async ({
    page
  }) => {
    await installDeterministicBitcoinReadMocks(page);
    await createWalletAndOpenHome({ page, withDeterministicNetwork: false });

    const ethereumAddress = await getPrimaryEthereumAddress(page);
    await fundAccountWithEth(ethereumAddress);

    await reloadAndUnlockIfNeeded(page);
    await openEthereumVaultDetail(page);

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

    await page.getByTestId('vault-detail-back-button').click();
    await expectHomeVisible(page);
    await expectAddressToAppearInHomeSection({
      page,
      address: ethereumAddress,
      status: 'withdrawn'
    });
    await expectWithdrawnEthereumAddressExcludedFromDeposit({
      page,
      withdrawnAddress: ethereumAddress
    });

    await reloadAndUnlockIfNeeded(page);

    await page
      .locator(`button[data-address="${ethereumAddress}"]`)
      .first()
      .click();

    await expect(page.getByTestId('vault-lifecycle-banner')).toHaveAttribute(
      'data-lifecycle-kind',
      'withdrawn'
    );
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeVisible();

    await page.getByTestId('vault-detail-back-button').click();
    await expectHomeVisible(page);

    await fundAccountWithEth(ethereumAddress);
    await reloadAndUnlockIfNeeded(page);
    await openEthereumVaultDetail(page, {
      address: ethereumAddress,
      withdrawButtonExpectation: 'visible'
    });

    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeEnabled();
    await openWithdrawDestinationStep(page);
    await expect(page.getByTestId('withdraw-step-destination')).toBeVisible();
  });

  test('applies BTC withdraw availability thresholds with inline message', async ({
    page
  }) => {
    await createWalletAndOpenHome({ page });
    const bitcoinAddress = await getPrimaryBitcoinAddress(page);

    await installDeterministicBitcoinReadMocks(page, {
      fundedTxoCount: 1,
      fundedTxoSum: bitcoinWithdrawThresholdSats - 1,
      txCount: 1
    });
    await reloadAndUnlockIfNeeded(page);
    await openBitcoinVaultDetail(page, {
      address: bitcoinAddress,
      withdrawButtonExpectation: 'visible'
    });
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeDisabled();
    await expect(page.getByText(belowBtcThresholdInlineMessage)).toBeVisible();
    await page.getByTestId('vault-detail-back-button').click();
    await expectHomeVisible(page);

    await installDeterministicBitcoinReadMocks(page, {
      fundedTxoCount: 1,
      fundedTxoSum: bitcoinWithdrawThresholdSats,
      txCount: 1
    });
    await reloadAndUnlockIfNeeded(page);
    await openBitcoinVaultDetail(page, {
      address: bitcoinAddress,
      withdrawButtonExpectation: 'visible'
    });
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeEnabled();
    await expect(page.getByText(belowBtcThresholdInlineMessage)).toHaveCount(0);
    await openWithdrawDestinationStep(page);
    await expect(page.getByTestId('withdraw-step-destination')).toBeVisible();
    await page.getByTestId('withdraw-add-address-cancel-button').click();
    await page.getByTestId('vault-detail-back-button').click();
    await expectHomeVisible(page);

    await installDeterministicBitcoinReadMocks(page);
    await reloadAndUnlockIfNeeded(page);
    await openBitcoinVaultDetail(page, {
      address: bitcoinAddress,
      withdrawButtonExpectation: 'hidden'
    });
    await expect(page.getByTestId('vault-detail-withdraw-button')).toBeHidden();
  });

  test('accepts supported BTC destination matrix above threshold', async ({
    page
  }) => {
    await createWalletAndOpenHome({ page });

    const bitcoinAddress = await getPrimaryBitcoinAddress(page);
    await installDeterministicBitcoinReadMocks(page, {
      fundedTxoCount: 1,
      fundedTxoSum: bitcoinWithdrawThresholdSats,
      txCount: 1
    });
    await reloadAndUnlockIfNeeded(page);
    await openBitcoinVaultDetail(page, {
      address: bitcoinAddress,
      withdrawButtonExpectation: 'visible'
    });

    const validBitcoinDestinations = [
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y'
    ];

    for (const destination of validBitcoinDestinations) {
      await openWithdrawDestinationStep(page);

      await page.getByTestId('destination-address-input').fill(destination);
      await page
        .locator('[data-testid="continue-button"][data-step="destination"]')
        .click();

      await expect(page.getByTestId('withdraw-step-review')).toBeVisible();
      await expect(page.getByText(destination)).toBeVisible();

      await page.getByTestId('withdraw-review-cancel-button').click();
      await expect(
        page.getByTestId('vault-detail-withdraw-button')
      ).toBeVisible();
    }
  });
});
