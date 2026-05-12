import { CurrencyValueText } from '@/components/currency/currency-value-text';
import type { CurrencyCode } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { getTokenCountLabel, vaultCardCopy } from '@/lib/copy';

import type { VaultCardBalanceDisplay } from './vault-card-balance';

export type VaultCardConfig = {
  rowSurfaceClassName: string;
  titleClassName: string;
  addressClassName: string;
  tokenCountClassName: string;
  valueClassName: string;
  valueMutedClassName: string;
  iconClassName: string;
};

type VaultCardBalanceContentProps = {
  balance: VaultCardBalanceDisplay;
  config: VaultCardConfig;
  currency: CurrencyCode;
};

export const VaultCardBalanceContent = ({
  balance,
  config,
  currency
}: VaultCardBalanceContentProps) => {
  if (balance.kind === 'unavailable') {
    return (
      <>
        <span
          className={cn(
            'type-body-tight text-footer-muted',
            config.valueClassName
          )}
        >
          {vaultCardCopy.unavailable}
        </span>
        <p
          className={cn(
            'type-body-sm leading-[14px] text-footer-muted',
            config.tokenCountClassName
          )}
        >
          {vaultCardCopy.unavailable}
        </p>
      </>
    );
  }

  return (
    <>
      <CurrencyValueText
        value={balance.totalBalance}
        currency={currency}
        className={cn('type-body-tight', config.valueClassName)}
        mutedClassName={config.valueMutedClassName}
      />
      <p
        className={cn(
          'type-body-sm leading-[14px]',
          config.tokenCountClassName
        )}
      >
        {getTokenCountLabel(balance.tokenCount)}
      </p>
    </>
  );
};
