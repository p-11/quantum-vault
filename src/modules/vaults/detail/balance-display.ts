import {
  isWithdrawalLifecycleKind,
  type VaultLifecycleKind
} from '@/modules/vaults/lifecycle/core';

import type { VaultData } from './types';

/**
 * Resolve the displayed TOTAL BALANCE for the Vault Detail header.
 *
 * Mirrors the Home VaultCard zero-collapse rule: once a withdrawal has been
 * initiated (pending / sent / withdrawn) the displayed total drops to zero
 * so the headline matches the lifecycle banner and the funds-panel state.
 * A failed withdrawal reverts the lifecycle and restores the live total.
 *
 * Returns `undefined` while vaultData is still loading; the caller renders a
 * skeleton in that branch.
 */
export const getVaultDetailDisplayedTotalCurrencyValue = ({
  vaultData,
  lifecycleKind
}: {
  vaultData: VaultData | undefined;
  lifecycleKind: VaultLifecycleKind;
}): number | undefined => {
  if (vaultData === undefined) {
    return undefined;
  }

  if (isWithdrawalLifecycleKind(lifecycleKind)) {
    return 0;
  }

  return vaultData.totalCurrencyValue;
};
