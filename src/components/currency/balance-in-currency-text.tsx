import type { Asset } from '@project-eleven/libqc';

import { CurrencyValueDisplayText } from '@/components/currency/currency-value-display-text';
import { useCurrency } from '@/hooks/use-currency';
import { useBalanceInCurrencyDisplay } from '@/hooks/use-balance-in-currency-display';

type BalanceInCurrencyTextProps = {
  balance: bigint;
  asset: Asset;
  className?: string;
  mutedClassName?: string;
};

export const BalanceInCurrencyText = ({
  balance,
  asset,
  className,
  mutedClassName
}: BalanceInCurrencyTextProps) => {
  const { currency } = useCurrency();
  const display = useBalanceInCurrencyDisplay({
    balance,
    asset,
    currencyCode: currency
  });

  return (
    <CurrencyValueDisplayText
      display={display}
      currency={currency}
      className={className}
      mutedClassName={mutedClassName}
    />
  );
};
