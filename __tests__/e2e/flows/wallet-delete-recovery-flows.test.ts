import { expect, test } from '@playwright/test';

import {
  createWalletAndOpenHome,
  expectAddressToAppearInHomeSection,
  expectHomeVisible,
  openEthereumVaultDetail,
  pasteRecoveryPhraseInput,
  readHomeSectionStatusForAddress,
  TEST_RECOVERY_MNEMONIC,
  TEST_USER_PASSWORD,
  vaultLoadTimeoutMs
} from '../helpers';
import {
  DEFAULT_RECOVERY_BTC_ADDRESS,
  DEFAULT_RECOVERY_EVM_ADDRESS,
  installDeterministicRecoveryNetwork
} from '../network-mocks';

const recoverButtonName = /Recover a Vault Account|I already have one/i;

test.describe('wallet delete and recovery lifecycle @flows', () => {
  test('classifies recovered exposed empty vaults as withdrawn after local records are deleted', async ({
    page
  }) => {
    await installDeterministicRecoveryNetwork({
      page,
      exposedEvmAddresses: [DEFAULT_RECOVERY_EVM_ADDRESS],
      bitcoinOutgoingAddresses: [DEFAULT_RECOVERY_BTC_ADDRESS]
    });
    await createWalletAndOpenHome({
      page,
      withDeterministicNetwork: false
    });

    await page.getByTestId('settings-button').click();
    await page.getByTestId('delete-quantum-vault-button').click();
    await expect(
      page.getByRole('heading', { name: 'Delete Quantum Vault' })
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'DELETE QUANTUM VAULT', exact: true })
      .click();

    await expect(
      page.getByRole('button', { name: recoverButtonName })
    ).toBeVisible({
      timeout: vaultLoadTimeoutMs
    });
    await page.getByRole('button', { name: recoverButtonName }).click();
    await pasteRecoveryPhraseInput({
      page,
      phrase: TEST_RECOVERY_MNEMONIC
    });
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER_PASSWORD);
    await page.getByLabel('Confirm Password').fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expectHomeVisible(page);

    await expectAddressToAppearInHomeSection({
      page,
      address: DEFAULT_RECOVERY_EVM_ADDRESS,
      status: 'withdrawn'
    });
    await expectAddressToAppearInHomeSection({
      page,
      address: DEFAULT_RECOVERY_BTC_ADDRESS,
      status: 'withdrawn'
    });
    await expect
      .poll(() =>
        readHomeSectionStatusForAddress({
          page,
          address: DEFAULT_RECOVERY_EVM_ADDRESS
        })
      )
      .not.toBe('vulnerable');
    await expect
      .poll(() =>
        readHomeSectionStatusForAddress({
          page,
          address: DEFAULT_RECOVERY_BTC_ADDRESS
        })
      )
      .not.toBe('vulnerable');

    await openEthereumVaultDetail(page, {
      address: DEFAULT_RECOVERY_EVM_ADDRESS,
      withdrawButtonExpectation: 'hidden'
    });
    await expect(page.getByTestId('vault-lifecycle-banner')).toHaveAttribute(
      'data-lifecycle-kind',
      'withdrawn'
    );
  });
});
