import { useQuery } from '@tanstack/react-query';
import type {
  Asset,
  BalanceResult,
  PersistedAccount
} from '@project-eleven/libqc';

import type { CurrencyCode } from '@/lib/currency';
import { attempt } from '@/lib/attempt';
import { getInterfaceAssets, totalCurrencyValue } from '@/lib/utils';
import {
  providerQueryKeys,
  type ProviderSummaryMode
} from '@/providers/query-keys';

const walletSummaryGcTimeMs = 5 * 60 * 1000;
const walletSummaryRefetchIntervalMs = 10_000;
const defaultWalletSummaryMode = 'inventory-only';

export type WalletSummaryMode = ProviderSummaryMode;

export type WalletSummary = {
  accounts: Array<PersistedAccount>;
  assets: Array<Asset>;
  balances: Array<BalanceResult>;
  totalBalance: number;
  isBalanceProviderUnavailable: boolean;
};

export type WalletBootState = {
  hasPassword: boolean;
  isUnlocked: boolean;
};

type InitWalletResult = 'ready' | 'degraded' | 'ignored';

export type WalletHydrationState =
  | { kind: 'no-password' }
  | { kind: 'locked' }
  | { kind: 'unlocked'; initWalletResult: InitWalletResult };

type WalletSummaryVaultShape = {
  listAccounts(): Promise<Array<PersistedAccount>>;
  listAssets(): Promise<Array<Asset>>;
  getTotalBalances(assets: Array<Asset>): Promise<Array<BalanceResult>>;
};

type WalletSummaryQuery = {
  state: {
    data?: WalletSummary;
  };
};

type WalletBootVaultShape = {
  hasPassword(): Promise<boolean>;
  isUnlocked(): boolean;
};

export const loadWalletSummary = async ({
  currency,
  mode = defaultWalletSummaryMode,
  vault
}: {
  currency: CurrencyCode;
  mode?: WalletSummaryMode;
  vault: WalletSummaryVaultShape;
}): Promise<WalletSummary> => {
  const accountsResult = await attempt(() => vault.listAccounts());
  const assetsResult = await attempt(() => vault.listAssets());

  const accounts = 'error' in accountsResult ? [] : accountsResult.data;
  const assets =
    'error' in assetsResult ? [] : getInterfaceAssets(assetsResult.data);

  if ('error' in accountsResult || 'error' in assetsResult) {
    return {
      accounts,
      assets,
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: true
    };
  }

  if (mode === 'inventory-only') {
    return {
      accounts,
      assets,
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: false
    };
  }

  const balancesResult = await attempt(() => vault.getTotalBalances(assets));
  if ('error' in balancesResult) {
    return {
      accounts,
      assets,
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: true
    };
  }

  const balances = balancesResult.data;
  const totalBalanceResult = await attempt(() =>
    totalCurrencyValue(assets, balances, currency)
  );

  if ('error' in totalBalanceResult) {
    return {
      accounts,
      assets,
      balances,
      totalBalance: 0,
      isBalanceProviderUnavailable: true
    };
  }

  return {
    accounts,
    assets,
    balances,
    totalBalance: totalBalanceResult.data,
    isBalanceProviderUnavailable: false
  };
};

export const loadWalletBootState = async (
  vault: WalletBootVaultShape
): Promise<WalletBootState> => {
  const hasPassword = await vault.hasPassword();

  return {
    hasPassword,
    isUnlocked: hasPassword ? vault.isUnlocked() : false
  };
};

export const shouldRefetchWalletSummary = (
  query: WalletSummaryQuery
): number | false =>
  query.state.data?.isBalanceProviderUnavailable
    ? walletSummaryRefetchIntervalMs
    : false;

const walletSummaryRefetchIntervalByMode: Record<
  WalletSummaryMode,
  typeof shouldRefetchWalletSummary | false
> = {
  full: shouldRefetchWalletSummary,
  'inventory-only': false
};

export const walletSummaryQueryOptions = ({
  currency,
  isEnabled,
  mode = defaultWalletSummaryMode,
  sessionId,
  vault
}: {
  currency: CurrencyCode;
  isEnabled: boolean;
  mode?: WalletSummaryMode;
  sessionId: number;
  vault: WalletSummaryVaultShape;
}) => ({
  queryKey: providerQueryKeys.summary({ currency, mode, sessionId }),
  queryFn: () => loadWalletSummary({ currency, mode, vault }),
  enabled: isEnabled,
  staleTime: Infinity,
  gcTime: walletSummaryGcTimeMs,
  retry: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchInterval: walletSummaryRefetchIntervalByMode[mode]
});

export const useWalletSummaryQuery = ({
  currency,
  isEnabled,
  mode = defaultWalletSummaryMode,
  sessionId,
  vault
}: {
  currency: CurrencyCode;
  isEnabled: boolean;
  mode?: WalletSummaryMode;
  sessionId: number;
  vault: WalletSummaryVaultShape;
}) =>
  useQuery(
    walletSummaryQueryOptions({ currency, isEnabled, mode, sessionId, vault })
  );

export const useWalletBootQuery = ({
  initWallet,
  isEnabled,
  vault
}: {
  initWallet(): Promise<InitWalletResult>;
  isEnabled: boolean;
  vault: WalletBootVaultShape;
}) =>
  useQuery({
    queryKey: providerQueryKeys.boot(),
    queryFn: async (): Promise<WalletHydrationState> => {
      const bootState = await loadWalletBootState(vault);
      if (!bootState.hasPassword) {
        return { kind: 'no-password' };
      }
      if (!bootState.isUnlocked) {
        return { kind: 'locked' };
      }
      return {
        kind: 'unlocked',
        initWalletResult: await initWallet()
      };
    },
    enabled: isEnabled,
    staleTime: Infinity,
    gcTime: walletSummaryGcTimeMs,
    retry: false,
    refetchOnWindowFocus: false
  });
