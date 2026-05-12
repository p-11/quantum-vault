import type { PersistedAccount } from '@project-eleven/libqc';

import type { VaultStatus } from '@/modules/vaults/core';
import type { VaultSnapshot } from '@/modules/vaults/types';
import type { LatestWithdrawalRecordByAccountId } from '@/providers/withdrawal-lifecycle';
import { ensurePresent } from '@/lib/assert';

import type { VaultLifecycleKind } from './core';
import { deriveVaultLifecycleStatus } from './adapter';
import type { VaultLifecycleStatus } from './types';

export type VaultLifecycleAccount = {
  account: PersistedAccount;
  accountId: string;
  snapshot: VaultSnapshot;
  lifecycleStatus: VaultLifecycleStatus;
  lifecycleKind: VaultLifecycleKind;
};

export type VaultLifecycleAccountReadModel = {
  accounts: Array<VaultLifecycleAccount>;
  lifecycleAccountByAccountId: Partial<Record<string, VaultLifecycleAccount>>;
  accountsByHomeStatus: Record<VaultStatus, Array<PersistedAccount>>;
  depositEligibleAccounts: Array<VaultLifecycleAccount>;
  getLifecycleKindForAccountId(accountId: string): VaultLifecycleKind;
  getDepositEligibleAccountsByChainId(
    chainId: string
  ): Array<VaultLifecycleAccount>;
  getSafeDestinationCandidatesFor(
    sourceAccount: PersistedAccount
  ): Array<VaultLifecycleAccount>;
};

type VaultLifecyclePolicy = {
  depositEligible: boolean;
  homeStatus: VaultStatus;
};

export const lifecyclePolicyByKind: Record<
  VaultLifecycleKind,
  VaultLifecyclePolicy
> = {
  safe: { depositEligible: true, homeStatus: 'safe' },
  vulnerable: { depositEligible: false, homeStatus: 'vulnerable' },
  pending: { depositEligible: false, homeStatus: 'withdrawn' },
  sent: { depositEligible: false, homeStatus: 'withdrawn' },
  withdrawn: { depositEligible: false, homeStatus: 'withdrawn' }
};

export const getHomeStatusForLifecycleKind = (
  lifecycleKind: VaultLifecycleKind
): VaultStatus => lifecyclePolicyByKind[lifecycleKind].homeStatus;

const getEmptyAccountsByHomeStatus = (): Record<
  VaultStatus,
  Array<PersistedAccount>
> => ({
  vulnerable: [],
  safe: [],
  withdrawn: []
});

const isDepositEligibleLifecycleAccount = ({
  snapshot,
  lifecycleKind
}: VaultLifecycleAccount): boolean =>
  !snapshot.isUnavailable &&
  snapshot.status === 'safe' &&
  lifecyclePolicyByKind[lifecycleKind].depositEligible;

export const resolveVaultLifecycleAccountReadModel = ({
  accounts,
  vaultSnapshotByAccountId,
  latestWithdrawalRecordByAccountId
}: {
  accounts: ReadonlyArray<PersistedAccount>;
  vaultSnapshotByAccountId: Partial<Record<string, VaultSnapshot>>;
  latestWithdrawalRecordByAccountId: LatestWithdrawalRecordByAccountId;
}): VaultLifecycleAccountReadModel => {
  const lifecycleAccounts = accounts.flatMap(account => {
    const accountId = account.id.toString();
    const snapshot = vaultSnapshotByAccountId[accountId];
    if (snapshot === undefined) {
      return [];
    }

    const lifecycleStatus = deriveVaultLifecycleStatus({
      snapshot,
      withdrawalRecord: latestWithdrawalRecordByAccountId[accountId]
    });

    return [
      {
        account,
        accountId,
        snapshot,
        lifecycleStatus,
        lifecycleKind: lifecycleStatus.kind
      }
    ];
  });

  const lifecycleAccountByAccountId: Partial<
    Record<string, VaultLifecycleAccount>
  > = {};
  for (const lifecycleAccount of lifecycleAccounts) {
    lifecycleAccountByAccountId[lifecycleAccount.accountId] = lifecycleAccount;
  }

  const depositEligibleAccounts = lifecycleAccounts.filter(
    isDepositEligibleLifecycleAccount
  );
  const accountsByHomeStatus = lifecycleAccounts.reduce(
    (acc, lifecycleAccount) => {
      const homeStatus = getHomeStatusForLifecycleKind(
        lifecycleAccount.lifecycleKind
      );
      acc[homeStatus].push(lifecycleAccount.account);
      return acc;
    },
    getEmptyAccountsByHomeStatus()
  );

  return {
    accounts: lifecycleAccounts,
    lifecycleAccountByAccountId,
    accountsByHomeStatus,
    depositEligibleAccounts,
    getLifecycleKindForAccountId: accountId =>
      ensurePresent(
        lifecycleAccountByAccountId[accountId],
        `lifecycle account for account ${accountId}`
      ).lifecycleKind,
    getDepositEligibleAccountsByChainId: chainId =>
      depositEligibleAccounts.filter(
        ({ account }) => account.chainId.toString() === chainId
      ),
    getSafeDestinationCandidatesFor: sourceAccount => {
      const sourceAccountId = sourceAccount.id.toString();
      const sourceLifecycleAccount =
        lifecycleAccountByAccountId[sourceAccountId];
      if (sourceLifecycleAccount?.lifecycleKind !== 'vulnerable') {
        return [];
      }

      return depositEligibleAccounts.filter(
        lifecycleAccount =>
          lifecycleAccount.accountId !== sourceAccountId &&
          lifecycleAccount.account.chainId.toString() ===
            sourceAccount.chainId.toString()
      );
    }
  };
};
