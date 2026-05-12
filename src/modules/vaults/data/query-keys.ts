import type { CurrencyCode } from '@/lib/currency';
import { queryNamespace, type QuerySessionScope } from '@/lib/query-keys';

const vaultQueryKeyDomains = {
  snapshots: 'snapshots',
  accountData: 'account-data',
  accountActivities: 'account-activities',
  vaultDetail: 'vault-detail'
} as const;

type QuerySessionCurrencyScope = QuerySessionScope & {
  currency: CurrencyCode;
};

type QuerySessionAccountScope = QuerySessionScope & {
  accountId: string | undefined;
};

type QuerySessionAccountCurrencyScope = QuerySessionAccountScope & {
  currency: CurrencyCode;
};

export const vaultQueryKeys = {
  snapshots: ({
    sessionId,
    currency,
    accountIdsKey
  }: QuerySessionCurrencyScope & { accountIdsKey: string }) =>
    [
      queryNamespace,
      vaultQueryKeyDomains.snapshots,
      sessionId,
      currency,
      accountIdsKey
    ] as const,
  snapshotsScope: ({ sessionId, currency }: QuerySessionCurrencyScope) =>
    [
      queryNamespace,
      vaultQueryKeyDomains.snapshots,
      sessionId,
      currency
    ] as const,
  accountDataScope: ({ sessionId }: QuerySessionScope) =>
    [queryNamespace, vaultQueryKeyDomains.accountData, sessionId] as const,
  accountData: ({
    sessionId,
    accountId,
    currency
  }: QuerySessionAccountCurrencyScope) =>
    [
      queryNamespace,
      vaultQueryKeyDomains.accountData,
      sessionId,
      accountId,
      currency
    ] as const,
  accountActivitiesScope: ({ sessionId }: QuerySessionScope) =>
    [
      queryNamespace,
      vaultQueryKeyDomains.accountActivities,
      sessionId
    ] as const,
  accountActivities: ({ sessionId, accountId }: QuerySessionAccountScope) =>
    [
      queryNamespace,
      vaultQueryKeyDomains.accountActivities,
      sessionId,
      accountId
    ] as const,
  vaultDetailScope: ({ sessionId }: QuerySessionScope) =>
    [queryNamespace, vaultQueryKeyDomains.vaultDetail, sessionId] as const,
  vaultDetail: ({
    sessionId,
    accountId,
    currency
  }: QuerySessionAccountCurrencyScope) =>
    [
      queryNamespace,
      vaultQueryKeyDomains.vaultDetail,
      sessionId,
      accountId,
      currency
    ] as const
} as const;
