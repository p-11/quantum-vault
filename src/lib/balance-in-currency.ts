import { formatUnits } from '@project-eleven/libqc';

import { formatCurrencyValue, type CurrencyCode } from '@/lib/currency';
import { matchRecordUnion } from '@/lib/match';

export const minCurrencyDisplayThreshold = 0.01;

export type BalanceInCurrencyDisplay =
  | { exact: number }
  | { belowThreshold: number }
  | { unavailable: true };

type ResolveBalanceInCurrencyDisplayInput = {
  balance: bigint;
  decimals: number;
  assetPrice: number | undefined;
};

export const resolveBalanceInCurrencyDisplay = ({
  balance,
  decimals,
  assetPrice
}: ResolveBalanceInCurrencyDisplayInput): BalanceInCurrencyDisplay => {
  if (balance === 0n) {
    return { exact: 0 };
  }

  if (assetPrice === undefined) {
    return { unavailable: true };
  }

  const computed = Number(formatUnits(balance, decimals)) * assetPrice;

  if (computed >= minCurrencyDisplayThreshold || computed === 0) {
    return { exact: computed };
  }

  return { belowThreshold: minCurrencyDisplayThreshold };
};

type FormatBalanceInCurrencyDisplayInput = {
  display: BalanceInCurrencyDisplay;
  currencyCode: CurrencyCode;
};

export const formatBalanceInCurrencyDisplay = ({
  display,
  currencyCode
}: FormatBalanceInCurrencyDisplayInput): string =>
  matchRecordUnion(display, {
    exact: amount => formatCurrencyValue(amount, currencyCode),
    belowThreshold: threshold =>
      `< ${formatCurrencyValue(threshold, currencyCode)}`,
    unavailable: () => '—'
  });

type FormatBalanceInCurrencyInput = {
  balance: bigint;
  decimals: number;
  assetPrice: number | undefined;
  currencyCode: CurrencyCode;
};

export const formatBalanceInCurrency = ({
  balance,
  decimals,
  assetPrice,
  currencyCode
}: FormatBalanceInCurrencyInput): string =>
  formatBalanceInCurrencyDisplay({
    display: resolveBalanceInCurrencyDisplay({
      balance,
      decimals,
      assetPrice
    }),
    currencyCode
  });
