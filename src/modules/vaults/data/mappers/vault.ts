import { type PersistedAccount } from '@project-eleven/libqc';

import { isWithdrawalLifecycleKind } from '../../lifecycle/core';
import type { VaultLifecycleAccount } from '../../lifecycle/account-read-model';
import type { AccountChainMetadata, VaultSnapshot } from '../../types';

export type TotalBalanceFromAccountSnapshotsResult =
  | { kind: 'value'; value: number }
  | { kind: 'unavailable' };

/**
 * Pure mappers used by Home + Vault Detail surfaces.
 * No side effects, no hooks, safe to call in render.
 */

/**
 * Build a `chainId.reference -> AccountChainMetadata` lookup from the
 * `vault.getSupportedChains()` return value so downstream renderers can
 * index by `account.chainId.reference` without re-scanning the chain array.
 */
export type SupportedChainShape = {
  chainId: { reference: string };
  iconUrl: string;
  name: string;
  nativeCurrency: { symbol: string };
};

export const buildAccountChainByReference = (
  supportedChains: ReadonlyArray<SupportedChainShape>
): Record<string, AccountChainMetadata> => {
  const result: Record<string, AccountChainMetadata> = {};
  for (const chain of supportedChains) {
    result[chain.chainId.reference] = {
      iconUrl: chain.iconUrl,
      name: chain.name,
      symbol: chain.nativeCurrency.symbol
    };
  }
  return result;
};

/**
 * Assign a stable vault number per account, scoped by chain.
 * First Ethereum account is #1, second Ethereum is #2, first Bitcoin is #1, etc.
 * Zero-padding to two digits (#01, #02) happens at render time (copy module).
 */
export const getVaultNumberByAccountId = (
  accounts: ReadonlyArray<PersistedAccount>
): Record<string, number> => {
  const perChainCount: Record<string, number> = {};
  const vaultNumberByAccountId: Record<string, number> = {};

  for (const account of accounts) {
    const chainReference = account.chainId.reference;
    const nextCount = (perChainCount[chainReference] ?? 0) + 1;
    perChainCount[chainReference] = nextCount;
    vaultNumberByAccountId[account.id.toString()] = nextCount;
  }

  return vaultNumberByAccountId;
};

/**
 * Aggregate the displayed total balance from per-account snapshots.
 *
 * Mirrors the per-VaultCard zero-collapse rule: any account whose
 * lifecycle is in a withdrawal state (pending / sent / withdrawn)
 * contributes zero, so the headline TOTAL BALANCE on Home stays
 * consistent with the cards beneath it. A failed withdrawal reverts
 * the lifecycle and the account contributes its live snapshot value
 * again on the next render.
 *
 * If any non-withdrawal lifecycle account has unavailable balance data,
 * returns `unavailable` so Home does not silently under-report the total.
 */
export const getTotalBalanceFromAccountSnapshots = ({
  lifecycleAccounts
}: {
  lifecycleAccounts: ReadonlyArray<
    Pick<VaultLifecycleAccount, 'lifecycleKind' | 'snapshot'>
  >;
}): TotalBalanceFromAccountSnapshotsResult => {
  let totalBalance = 0;

  for (const { lifecycleKind, snapshot } of lifecycleAccounts) {
    if (isWithdrawalLifecycleKind(lifecycleKind)) {
      continue;
    }
    if (snapshot.isUnavailable || snapshot.totalBalance === null) {
      return { kind: 'unavailable' };
    }
    totalBalance += snapshot.totalBalance;
  }

  return { kind: 'value', value: totalBalance };
};

/**
 * Create a placeholder snapshot for accounts whose fetch fails.
 * Consumers render `--` for balance and token count in this state.
 */
export const getUnavailableSnapshot = (): VaultSnapshot => ({
  isUnavailable: true,
  status: null,
  tokenCount: null,
  totalBalance: null
});
