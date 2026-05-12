import {
  type BalanceInCurrencyDisplay,
  resolveBalanceInCurrencyDisplay
} from '@/lib/balance-in-currency';
import type { CurrencyCode } from '@/lib/currency';
import { sharedQueryKeys } from '@/lib/query-keys';
import { getAssetPrice, priceCacheTtlMs } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import type { Asset } from '@project-eleven/libqc';

type UseBalanceInCurrencyDisplayInput = {
  balance: bigint;
  asset: Asset;
  currencyCode: CurrencyCode;
};

const assetPriceQueryGcTimeMs = priceCacheTtlMs * 5;

export const useBalanceInCurrencyDisplay = ({
  balance,
  asset,
  currencyCode
}: UseBalanceInCurrencyDisplayInput): BalanceInCurrencyDisplay => {
  const assetPriceQuery = useQuery({
    queryKey: sharedQueryKeys.assetPrice({
      assetSymbol: asset.symbol,
      currency: currencyCode
    }),
    queryFn: () => getAssetPrice(asset, currencyCode),
    enabled: balance > 0n,
    retry: false,
    gcTime: assetPriceQueryGcTimeMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
    staleTime: priceCacheTtlMs
  });

  return resolveBalanceInCurrencyDisplay({
    balance,
    decimals: asset.decimals,
    assetPrice: assetPriceQuery.data
  });
};
