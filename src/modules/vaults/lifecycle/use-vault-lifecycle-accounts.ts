import { useVaultAccountSnapshotsQuery } from '@/modules/vaults/data/hooks';
import type { VaultSnapshot } from '@/modules/vaults/types';
import type { LatestWithdrawalRecordByAccountId } from '@/providers/withdrawal-lifecycle';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  resolveVaultLifecycleAccountReadModel,
  type VaultLifecycleAccountReadModel
} from './account-read-model';

type UseVaultLifecycleAccountsInput = Parameters<
  typeof useVaultAccountSnapshotsQuery
>[0] & {
  latestWithdrawalRecordByAccountId: LatestWithdrawalRecordByAccountId;
};

export type UseVaultLifecycleAccountsResult = {
  vaultSnapshotByAccountId: Partial<Record<string, VaultSnapshot>>;
  isLoading: boolean;
  isError: boolean;
  vaultSnapshotsQuery: UseQueryResult<Record<string, VaultSnapshot>>;
} & VaultLifecycleAccountReadModel;

export const useVaultLifecycleAccounts = ({
  accounts,
  vault,
  currency,
  sessionId,
  latestWithdrawalRecordByAccountId
}: UseVaultLifecycleAccountsInput): UseVaultLifecycleAccountsResult => {
  const vaultSnapshotsQuery = useVaultAccountSnapshotsQuery({
    accounts,
    vault,
    currency,
    sessionId
  });
  const vaultSnapshotByAccountId = vaultSnapshotsQuery.data ?? {};
  const readModel = resolveVaultLifecycleAccountReadModel({
    accounts,
    vaultSnapshotByAccountId,
    latestWithdrawalRecordByAccountId
  });

  return {
    vaultSnapshotByAccountId,
    isLoading: vaultSnapshotsQuery.isPending,
    isError: vaultSnapshotsQuery.isError,
    vaultSnapshotsQuery,
    ...readModel
  };
};
