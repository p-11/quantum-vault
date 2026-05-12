import type { CurrencyCode } from '@/lib/currency';
import { queryNamespace, type QuerySessionScope } from '@/lib/query-keys';

const providerQueryKeyDomains = {
  boot: 'boot',
  summary: 'summary'
} as const;

export type ProviderSummaryMode = 'full' | 'inventory-only';

type QuerySessionCurrencyModeScope = QuerySessionScope & {
  currency: CurrencyCode;
  mode: ProviderSummaryMode;
};

export const providerQueryKeys = {
  boot: () => [queryNamespace, providerQueryKeyDomains.boot] as const,
  summary: ({ sessionId, currency, mode }: QuerySessionCurrencyModeScope) =>
    [
      queryNamespace,
      providerQueryKeyDomains.summary,
      sessionId,
      currency,
      mode
    ] as const
} as const;
