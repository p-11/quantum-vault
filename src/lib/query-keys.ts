import type { CurrencyCode } from './currency';

export const queryNamespace = 'quantum-vault';

const sharedQueryKeyDomains = {
  assetPrice: 'asset-price'
} as const;

export type QuerySessionScope = {
  sessionId: number;
};

type QueryAssetPriceScope = {
  assetSymbol: string;
  currency: CurrencyCode;
};

export const sharedQueryKeys = {
  all: [queryNamespace] as const,
  assetPrice: ({ assetSymbol, currency }: QueryAssetPriceScope) =>
    [
      queryNamespace,
      sharedQueryKeyDomains.assetPrice,
      assetSymbol,
      currency
    ] as const
} as const;
