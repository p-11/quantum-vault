import type { ReactNode } from 'react';

import {
  CurrencyValueText,
  defaultCurrencyValueMutedClassName
} from '@/components/currency/currency-value-text';
import type { BalanceInCurrencyDisplay } from '@/lib/balance-in-currency';
import type { CurrencyCode } from '@/lib/currency';
import { matchRecordUnion } from '@/lib/match';
import { twMerge } from 'tailwind-merge';

type CurrencyValueDisplayTextProps = {
  display: BalanceInCurrencyDisplay;
  currency: CurrencyCode;
  className?: string;
  mutedClassName?: string;
};

export const CurrencyValueDisplayText = ({
  display,
  currency,
  className,
  mutedClassName
}: CurrencyValueDisplayTextProps): ReactNode => {
  const effectiveMutedClassName =
    mutedClassName ?? defaultCurrencyValueMutedClassName;

  return matchRecordUnion(display, {
    exact: (amount): ReactNode => (
      <CurrencyValueText
        value={amount}
        currency={currency}
        className={className}
        mutedClassName={effectiveMutedClassName}
      />
    ),
    belowThreshold: threshold => (
      <CurrencyValueText
        value={threshold}
        currency={currency}
        className={className}
        mutedClassName={effectiveMutedClassName}
        prefix='< '
      />
    ),
    unavailable: () => (
      <span className={twMerge(className, effectiveMutedClassName)}>{'—'}</span>
    )
  });
};
