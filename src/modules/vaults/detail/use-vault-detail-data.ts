import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useWallet } from '@/hooks/use-wallet';
import type { VaultStatus } from '@/modules/vaults/core';
import {
  isInterfaceActivity,
  mapActivityToRow
} from '@/modules/vaults/data/mappers/activity';
import { vaultQueryKeys } from '@/modules/vaults/data/query-keys';
import type { VaultLifecycleKind } from '@/modules/vaults/lifecycle/core';
import { getVaultLifecycleStatus } from '@/modules/vaults/lifecycle/hooks';
import type { VaultLifecycleStatus } from '@/modules/vaults/lifecycle/types';
import { ensurePresent } from '@/lib/assert';
import { convertDuration } from '@/lib/time';
import {
  getInterfaceAssets,
  getPositiveNonInterfaceAssetBalances,
  totalCurrencyValue
} from '@/lib/utils';
import type { LatestWithdrawalRecordByAccountId } from '@/providers/withdrawal-lifecycle';

import {
  getLifecycleDestinationAddress,
  getLifecyclePrimaryTxRef
} from './core';
import type {
  UseVaultDetailDataInput,
  UseVaultDetailDataResult,
  VaultData,
  VaultDetailQueryData
} from './types';

const vaultDetailQueryGcTimeMs = convertDuration(5, 'min', 'ms');
export const vaultActivitiesQueryFreshnessPolicy = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
  refetchOnReconnect: true
} as const;

const lifecycleKindToVaultState: Record<VaultLifecycleKind, VaultStatus> = {
  safe: 'safe',
  vulnerable: 'vulnerable',
  pending: 'withdrawn',
  sent: 'withdrawn',
  withdrawn: 'withdrawn'
};

const lifecycleKindRequiresActivities: Record<VaultLifecycleKind, boolean> = {
  safe: false,
  vulnerable: false,
  pending: true,
  sent: true,
  withdrawn: true
};

const hasLifecycleActivityFallbackInput = (
  lifecycleStatus: VaultLifecycleStatus
): boolean =>
  lifecycleKindRequiresActivities[lifecycleStatus.kind] &&
  getLifecyclePrimaryTxRef(lifecycleStatus) === null &&
  getLifecycleDestinationAddress(lifecycleStatus) !== null;

export const shouldLoadVaultActivities = ({
  activeTabId,
  hasSelectedAccount,
  hasVaultDetailData,
  lifecycleStatus
}: {
  activeTabId: UseVaultDetailDataInput['activeTabId'];
  hasSelectedAccount: boolean;
  hasVaultDetailData: boolean;
  lifecycleStatus: VaultLifecycleStatus;
}): boolean =>
  hasSelectedAccount &&
  hasVaultDetailData &&
  (activeTabId === 'activity' ||
    hasLifecycleActivityFallbackInput(lifecycleStatus));

export const shouldHandleVaultDetailQueryError = ({
  activitiesQueryIsError,
  shouldLoadActivities,
  vaultDetailQueryIsError
}: {
  activitiesQueryIsError: boolean;
  shouldLoadActivities: boolean;
  vaultDetailQueryIsError: boolean;
}): boolean =>
  vaultDetailQueryIsError || (shouldLoadActivities && activitiesQueryIsError);

export const shouldTriggerVaultDetailUnexpectedError = ({
  activitiesQueryIsError,
  hasHandledError,
  shouldLoadActivities,
  vaultDetailQueryIsError
}: {
  activitiesQueryIsError: boolean;
  hasHandledError: boolean;
  shouldLoadActivities: boolean;
  vaultDetailQueryIsError: boolean;
}): boolean =>
  !hasHandledError &&
  shouldHandleVaultDetailQueryError({
    activitiesQueryIsError,
    shouldLoadActivities,
    vaultDetailQueryIsError
  });

const loadVaultDetailQueryData = async ({
  accountId,
  currency,
  vault
}: {
  accountId: Parameters<UseVaultDetailDataInput['vault']['getAccount']>[0];
  currency: UseVaultDetailDataInput['currency'];
  vault: UseVaultDetailDataInput['vault'];
}): Promise<VaultDetailQueryData> => {
  const accountClient = await vault.getAccount(accountId);
  const [trackedAssets, status] = await Promise.all([
    accountClient.listAssets(),
    accountClient.getStatus()
  ]);
  const trackedBalances = await accountClient.getBalances(trackedAssets);
  const hasNonInterfaceAssetBalance =
    getPositiveNonInterfaceAssetBalances({
      assets: trackedAssets,
      balances: trackedBalances
    }).length > 0;
  const assets = getInterfaceAssets(trackedAssets);
  const interfaceAssetSymbols = new Set(assets.map(asset => asset.symbol));
  const balances = trackedBalances.filter(balance =>
    interfaceAssetSymbols.has(balance.symbol)
  );
  const total = await totalCurrencyValue(assets, balances, currency);

  return {
    assets,
    balances,
    hasNonInterfaceAssetBalance,
    vaultState: status,
    totalCurrencyValue: total
  };
};

const loadVaultActivitiesRows = async ({
  accountId,
  assets,
  vault,
  vaultAddress
}: {
  accountId: Parameters<UseVaultDetailDataInput['vault']['getAccount']>[0];
  assets: VaultData['assets'];
  vault: UseVaultDetailDataInput['vault'];
  vaultAddress: string;
}): Promise<VaultData['activities']> => {
  const accountClient = await vault.getAccount(accountId);
  const rawActivities = await accountClient.getActivities();

  return rawActivities.filter(isInterfaceActivity).map((activity, index) =>
    mapActivityToRow({
      activity,
      vaultAddress,
      assets,
      index
    })
  );
};

const resolveLifecycleStatus = ({
  selectedAccount,
  vaultDetailQueryData,
  latestWithdrawalRecordByAccountId
}: {
  selectedAccount: UseVaultDetailDataInput['selectedAccount'];
  vaultDetailQueryData: VaultDetailQueryData | undefined;
  latestWithdrawalRecordByAccountId: LatestWithdrawalRecordByAccountId;
}): VaultLifecycleStatus => {
  if (selectedAccount === undefined || vaultDetailQueryData === undefined) {
    return { kind: 'safe' };
  }
  const accountId = selectedAccount.id.toString();
  const positiveBalanceCount = vaultDetailQueryData.balances.filter(
    balance => balance.balance > 0n
  ).length;
  const tokenCount =
    positiveBalanceCount +
    (vaultDetailQueryData.hasNonInterfaceAssetBalance ? 1 : 0);

  return getVaultLifecycleStatus({
    withdrawalRecord: latestWithdrawalRecordByAccountId[accountId],
    snapshot: {
      status: vaultDetailQueryData.vaultState,
      isUnavailable: false,
      tokenCount,
      totalBalance: vaultDetailQueryData.totalCurrencyValue
    }
  });
};

const resolveVaultData = ({
  vaultDetailQueryData,
  activities
}: {
  vaultDetailQueryData: VaultDetailQueryData | undefined;
  activities: VaultData['activities'] | undefined;
}): VaultData | undefined => {
  if (vaultDetailQueryData === undefined) {
    return undefined;
  }

  return {
    assets: vaultDetailQueryData.assets,
    balances: vaultDetailQueryData.balances,
    activities: activities ?? [],
    hasNonInterfaceAssetBalance:
      vaultDetailQueryData.hasNonInterfaceAssetBalance,
    onChainVaultStatus: vaultDetailQueryData.vaultState,
    totalCurrencyValue: vaultDetailQueryData.totalCurrencyValue
  };
};

export const resolveVaultDetailQueryError = ({
  vaultDetailIsError,
  vaultDetailError,
  activitiesIsError,
  activitiesError
}: {
  vaultDetailIsError: boolean;
  vaultDetailError: unknown;
  activitiesIsError: boolean;
  activitiesError: unknown;
}): unknown | undefined => {
  if (vaultDetailIsError) {
    return vaultDetailError;
  }

  if (activitiesIsError) {
    return activitiesError;
  }

  return undefined;
};

export const useVaultDetailData = ({
  activeTabId,
  currency,
  onUnexpectedError,
  selectedAccount,
  sessionId,
  vault
}: UseVaultDetailDataInput): UseVaultDetailDataResult => {
  const { latestWithdrawalRecordByAccountId } = useWallet();
  const selectedAccountId = selectedAccount?.id.toString();
  const onUnexpectedErrorRef = useRef(onUnexpectedError);
  const hasHandledErrorRef = useRef(false);

  useEffect(() => {
    onUnexpectedErrorRef.current = onUnexpectedError;
  }, [onUnexpectedError]);

  const vaultDetailQuery = useQuery({
    queryKey: vaultQueryKeys.vaultDetail({
      sessionId,
      accountId: selectedAccountId,
      currency
    }),
    enabled: selectedAccount !== undefined,
    staleTime: Infinity,
    gcTime: vaultDetailQueryGcTimeMs,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () =>
      loadVaultDetailQueryData({
        accountId: ensurePresent(selectedAccount, 'selected account').id,
        currency,
        vault
      })
  });

  const lifecycleStatus = resolveLifecycleStatus({
    selectedAccount,
    vaultDetailQueryData: vaultDetailQuery.data,
    latestWithdrawalRecordByAccountId
  });
  const lifecycleKind = lifecycleStatus.kind;

  const shouldLoadActivities = shouldLoadVaultActivities({
    activeTabId,
    hasSelectedAccount: selectedAccount !== undefined,
    hasVaultDetailData: vaultDetailQuery.data !== undefined,
    lifecycleStatus
  });

  const activitiesQuery = useQuery({
    ...vaultActivitiesQueryFreshnessPolicy,
    queryKey: vaultQueryKeys.accountActivities({
      sessionId,
      accountId: selectedAccountId
    }),
    enabled: shouldLoadActivities,
    gcTime: vaultDetailQueryGcTimeMs,
    retry: false,
    queryFn: () =>
      loadVaultActivitiesRows({
        accountId: ensurePresent(selectedAccount, 'selected account').id,
        assets: ensurePresent(vaultDetailQuery.data, 'vault detail query data')
          .assets,
        vault,
        vaultAddress: ensurePresent(selectedAccount, 'selected account').address
      })
  });

  useEffect(() => {
    hasHandledErrorRef.current = false;
  }, [selectedAccountId, sessionId]);

  useEffect(() => {
    const activitiesQueryHasData = activitiesQuery.data !== undefined;
    const shouldHandleActivitiesQueryError =
      activitiesQuery.isError && !activitiesQueryHasData;
    const shouldTriggerUnexpectedError =
      shouldTriggerVaultDetailUnexpectedError({
        activitiesQueryIsError: shouldHandleActivitiesQueryError,
        hasHandledError: hasHandledErrorRef.current,
        shouldLoadActivities,
        vaultDetailQueryIsError: vaultDetailQuery.isError
      });

    if (!shouldTriggerUnexpectedError) {
      return;
    }

    const queryError = resolveVaultDetailQueryError({
      vaultDetailIsError: vaultDetailQuery.isError,
      vaultDetailError: vaultDetailQuery.error,
      activitiesIsError: shouldHandleActivitiesQueryError,
      activitiesError: activitiesQuery.error
    });
    if (queryError !== undefined) {
      hasHandledErrorRef.current = true;
      onUnexpectedErrorRef.current(queryError);
    }
  }, [
    activitiesQuery.error,
    activitiesQuery.isError,
    activitiesQuery.data,
    shouldLoadActivities,
    vaultDetailQuery.error,
    vaultDetailQuery.isError
  ]);

  const vaultData = resolveVaultData({
    vaultDetailQueryData: vaultDetailQuery.data,
    activities: activitiesQuery.data
  });
  const isActivityLoading =
    shouldLoadActivities && activitiesQuery.data === undefined;

  const vaultState: VaultStatus = lifecycleKindToVaultState[lifecycleKind];

  return {
    vaultData,
    vaultDetailQuery,
    isActivityLoading,
    vaultState,
    lifecycleKind,
    lifecycleStatus
  };
};
