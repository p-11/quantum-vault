import { useQuery } from '@tanstack/react-query';
import type {
  AccountClientInterface,
  Asset,
  BalanceResult,
  PersistedAccount
} from '@project-eleven/libqc';

import type { CurrencyCode } from '@/lib/currency';
import { ensurePresent } from '@/lib/assert';
import { getInterfaceAssets, totalCurrencyValue } from '@/lib/utils';

import type { VaultStatus } from '../core';
import {
  isInterfaceActivity,
  type InterfaceActivity
} from './mappers/activity';
import { vaultQueryKeys } from './query-keys';

const queryGcTimeMs = 5 * 60 * 1000;

type AccountQueryVaultShape = {
  getAccount(accountId: PersistedAccount['id'] | string): Promise<
    AccountClientInterface & {
      getConfig?(): Promise<unknown>;
    }
  >;
};

export type AccountData = {
  config: unknown;
  activities: Array<InterfaceActivity>;
  balances: Array<BalanceResult>;
  assets: Array<Asset>;
  totalCurrencyValue: number;
};

export type VaultDetailData = {
  assets: Array<Asset>;
  balances: Array<BalanceResult>;
  totalCurrencyValue: number;
  vaultState: VaultStatus;
};

export const loadAccountData = async ({
  accountId,
  currency,
  vault
}: {
  accountId: PersistedAccount['id'] | string;
  currency: CurrencyCode;
  vault: AccountQueryVaultShape;
}): Promise<AccountData> => {
  const accountClient = await vault.getAccount(accountId);
  const [trackedAssets, config, activities] = await Promise.all([
    accountClient.listAssets(),
    accountClient.getConfig ? accountClient.getConfig() : Promise.resolve(null),
    accountClient.getActivities()
  ]);
  const assets = getInterfaceAssets(trackedAssets);
  const balances = await accountClient.getBalances(assets);
  const total = await totalCurrencyValue(assets, balances, currency);

  return {
    assets,
    activities: activities.filter(isInterfaceActivity),
    balances,
    config,
    totalCurrencyValue: total
  };
};

export const loadVaultDetailData = async ({
  accountId,
  currency,
  vault
}: {
  accountId: PersistedAccount['id'] | string;
  currency: CurrencyCode;
  vault: AccountQueryVaultShape;
}): Promise<VaultDetailData> => {
  const accountClient = await vault.getAccount(accountId);
  const [trackedAssets, status] = await Promise.all([
    accountClient.listAssets(),
    accountClient.getStatus()
  ]);
  const assets = getInterfaceAssets(trackedAssets);
  const balances = await accountClient.getBalances(assets);
  const total = await totalCurrencyValue(assets, balances, currency);

  return {
    assets,
    balances,
    totalCurrencyValue: total,
    vaultState: status
  };
};

export const useAccountDataQuery = ({
  currency,
  selectedAccount,
  sessionId,
  vault
}: {
  currency: CurrencyCode;
  selectedAccount?: PersistedAccount;
  sessionId: number;
  vault: AccountQueryVaultShape;
}) =>
  useQuery({
    queryKey: vaultQueryKeys.accountData({
      sessionId,
      accountId: selectedAccount?.id.toString(),
      currency
    }),
    enabled: selectedAccount !== undefined,
    staleTime: Infinity,
    gcTime: queryGcTimeMs,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () =>
      loadAccountData({
        accountId: ensurePresent(selectedAccount, 'selected account id').id,
        currency,
        vault
      })
  });

export const useVaultDetailDataQuery = ({
  currency,
  selectedAccount,
  sessionId,
  vault
}: {
  currency: CurrencyCode;
  selectedAccount?: PersistedAccount;
  sessionId: number;
  vault: AccountQueryVaultShape;
}) =>
  useQuery({
    queryKey: vaultQueryKeys.vaultDetail({
      sessionId,
      accountId: selectedAccount?.id.toString(),
      currency
    }),
    enabled: selectedAccount !== undefined,
    staleTime: Infinity,
    gcTime: queryGcTimeMs,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () =>
      loadVaultDetailData({
        accountId: ensurePresent(selectedAccount, 'selected account id').id,
        currency,
        vault
      })
  });
