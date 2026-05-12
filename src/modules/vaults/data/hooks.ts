import {
  type QueryClient,
  useQuery,
  useQueryClient,
  type UseQueryResult
} from '@tanstack/react-query';
import { type PersistedAccount } from '@project-eleven/libqc';
import { useRef } from 'react';

import type { CurrencyCode } from '@/lib/currency';
import { ensurePresent } from '@/lib/assert';
import { attempt } from '@/lib/attempt';
import {
  getInterfaceAssets,
  getPositiveNonInterfaceAssetBalances,
  totalCurrencyValue
} from '@/lib/utils';

import type { VaultStatus } from '../core';
import type { VaultDetailQueryData } from '../detail/types';
import type { VaultSnapshot } from '../types';
import { vaultQueryKeys } from './query-keys';
import { getUnavailableSnapshot } from './mappers/vault';
import { resolveSnapshotWithStickyStatus } from './snapshot-status';

type WalletAssets = Parameters<typeof totalCurrencyValue>[0];
type WalletBalances = Parameters<typeof totalCurrencyValue>[1];

type AccountSnapshotVaultShape = {
  getAccount(id: PersistedAccount['id']): Promise<{
    getStatus(): Promise<VaultStatus>;
    listAssets(): Promise<WalletAssets>;
    getBalances(assets: WalletAssets): Promise<WalletBalances>;
  }>;
};

type UseVaultAccountSnapshotsInput = {
  accounts: ReadonlyArray<PersistedAccount>;
  vault: AccountSnapshotVaultShape;
  currency: CurrencyCode;
  sessionId: number;
};

type StickyStatusByAccountId = Partial<Record<string, VaultStatus | null>>;

type VaultSnapshotsQueryInput = {
  accounts: UseVaultAccountSnapshotsInput['accounts'];
  vault: AccountSnapshotVaultShape;
  currency: UseVaultAccountSnapshotsInput['currency'];
  sessionId: UseVaultAccountSnapshotsInput['sessionId'];
  queryClient: QueryClient;
  stickyStatusByAccountId: StickyStatusByAccountId;
};

type AccountSnapshotResult = {
  accountId: string;
  snapshot: VaultSnapshot;
  vaultDetailQueryData?: VaultDetailQueryData;
};

const vaultSnapshotsGcTimeMs = 5 * 60 * 1000;
const emptyVaultSnapshotByAccountId: Record<string, VaultSnapshot> = {};

const getAccountIdsKey = (accounts: ReadonlyArray<PersistedAccount>): string =>
  accounts.map(account => account.id.toString()).join(',');

const shouldPrefillVaultDetailQueryData = ({
  queryClient,
  snapshotsKey,
  vaultDetailKey
}: {
  queryClient: QueryClient;
  snapshotsKey: ReturnType<(typeof vaultQueryKeys)['snapshots']>;
  vaultDetailKey: ReturnType<(typeof vaultQueryKeys)['vaultDetail']>;
}): boolean => {
  const snapshotsQueryState = queryClient.getQueryState(snapshotsKey);
  if (snapshotsQueryState?.fetchStatus !== 'fetching') {
    return false;
  }

  const vaultDetailQueryState = queryClient.getQueryState(vaultDetailKey);
  return (
    vaultDetailQueryState?.data === undefined &&
    vaultDetailQueryState?.fetchStatus !== 'fetching'
  );
};

const clearInactiveVaultDetailQuery = ({
  queryClient,
  vaultDetailKey
}: {
  queryClient: QueryClient;
  vaultDetailKey: ReturnType<(typeof vaultQueryKeys)['vaultDetail']>;
}) => {
  queryClient.removeQueries({
    queryKey: vaultDetailKey,
    exact: true,
    type: 'inactive'
  });
};

export const loadVaultSnapshots = async ({
  accounts,
  vault,
  currency,
  sessionId,
  queryClient,
  stickyStatusByAccountId
}: VaultSnapshotsQueryInput): Promise<Record<string, VaultSnapshot>> => {
  const snapshotsKey = vaultQueryKeys.snapshots({
    sessionId,
    currency,
    accountIdsKey: getAccountIdsKey(accounts)
  });
  const previousSnapshots =
    queryClient.getQueryData<Partial<Record<string, VaultSnapshot>>>(
      snapshotsKey
    );

  const snapshotResults = await Promise.allSettled<AccountSnapshotResult>(
    accounts.map(async account => {
      const accountClient = await vault.getAccount(account.id);
      const statusResult = await attempt(() => accountClient.getStatus());
      const status = 'error' in statusResult ? null : statusResult.data;

      const accountAssetsResult = await attempt(() =>
        accountClient.listAssets()
      );
      if ('error' in accountAssetsResult) {
        return {
          accountId: account.id.toString(),
          snapshot: { ...getUnavailableSnapshot(), status }
        };
      }

      const trackedAssets = accountAssetsResult.data;
      const trackedBalancesResult = await attempt(() =>
        accountClient.getBalances(trackedAssets)
      );
      if ('error' in trackedBalancesResult) {
        return {
          accountId: account.id.toString(),
          snapshot: { ...getUnavailableSnapshot(), status }
        };
      }

      const trackedBalances = trackedBalancesResult.data;
      const nonInterfaceBalanceCount = getPositiveNonInterfaceAssetBalances({
        assets: trackedAssets,
        balances: trackedBalances
      }).length;
      const accountAssets = getInterfaceAssets(trackedAssets);
      const interfaceAssetSymbols = new Set(
        accountAssets.map(asset => asset.symbol)
      );
      const accountBalances = trackedBalances.filter(balance =>
        interfaceAssetSymbols.has(balance.symbol)
      );
      const totalBalanceResult = await attempt(() =>
        totalCurrencyValue(accountAssets, accountBalances, currency)
      );
      if ('error' in totalBalanceResult) {
        return {
          accountId: account.id.toString(),
          snapshot: { ...getUnavailableSnapshot(), status }
        };
      }

      const tokenCount =
        accountBalances.filter(balance => balance.balance > 0n).length +
        nonInterfaceBalanceCount;

      return {
        accountId: account.id.toString(),
        snapshot: {
          status,
          isUnavailable: false,
          tokenCount,
          totalBalance: totalBalanceResult.data
        },
        vaultDetailQueryData:
          status === null
            ? undefined
            : {
                assets: accountAssets,
                balances: accountBalances,
                hasNonInterfaceAssetBalance: nonInterfaceBalanceCount > 0,
                vaultState: status,
                totalCurrencyValue: totalBalanceResult.data
              }
      };
    })
  );

  const nextSnapshots: Partial<Record<string, VaultSnapshot>> = {};
  for (let index = 0; index < snapshotResults.length; index += 1) {
    const result = snapshotResults[index];
    const account = accounts[index];
    if (!account) {
      continue;
    }
    const accountId = account.id.toString();
    const vaultDetailKey = vaultQueryKeys.vaultDetail({
      sessionId,
      accountId,
      currency
    });
    if (result?.status === 'fulfilled') {
      nextSnapshots[accountId] = result.value.snapshot;
      if (result.value.vaultDetailQueryData !== undefined) {
        if (
          shouldPrefillVaultDetailQueryData({
            queryClient,
            snapshotsKey,
            vaultDetailKey
          })
        ) {
          queryClient.setQueryData(
            vaultDetailKey,
            result.value.vaultDetailQueryData
          );
        }
      } else {
        clearInactiveVaultDetailQuery({ queryClient, vaultDetailKey });
      }
      continue;
    }
    nextSnapshots[accountId] = getUnavailableSnapshot();
    clearInactiveVaultDetailQuery({ queryClient, vaultDetailKey });
  }

  const resolved: Record<string, VaultSnapshot> = {};
  for (const account of accounts) {
    const accountId = account.id.toString();
    const next = ensurePresent(
      nextSnapshots[accountId],
      `snapshot for account ${accountId}`
    );
    const previousStickyStatus = stickyStatusByAccountId[accountId];
    const previousSnapshotStatus = previousSnapshots?.[accountId]?.status;
    resolved[accountId] = resolveSnapshotWithStickyStatus({
      next,
      previousStatus: previousStickyStatus ?? previousSnapshotStatus
    });
    stickyStatusByAccountId[accountId] = resolved[accountId].status;
  }

  return resolved;
};

export const vaultSnapshotsQueryOptions = ({
  accounts,
  vault,
  currency,
  sessionId,
  queryClient,
  stickyStatusByAccountId
}: VaultSnapshotsQueryInput) => ({
  queryKey: vaultQueryKeys.snapshots({
    sessionId,
    currency,
    accountIdsKey: getAccountIdsKey(accounts)
  }),
  enabled: accounts.length > 0,
  staleTime: Infinity,
  gcTime: vaultSnapshotsGcTimeMs,
  retry: false,
  refetchOnWindowFocus: false,
  initialData:
    accounts.length === 0 ? emptyVaultSnapshotByAccountId : undefined,
  queryFn: () =>
    loadVaultSnapshots({
      accounts,
      vault,
      currency,
      sessionId,
      queryClient,
      stickyStatusByAccountId
    })
});

export const useVaultAccountSnapshotsQuery = ({
  accounts,
  vault,
  currency,
  sessionId
}: UseVaultAccountSnapshotsInput): UseQueryResult<
  Record<string, VaultSnapshot>
> => {
  const queryClient = useQueryClient();
  const stickyStatusByAccountIdRef = useRef<StickyStatusByAccountId>({});

  return useQuery(
    vaultSnapshotsQueryOptions({
      accounts,
      vault,
      currency,
      sessionId,
      queryClient,
      stickyStatusByAccountId: stickyStatusByAccountIdRef.current
    })
  );
};
