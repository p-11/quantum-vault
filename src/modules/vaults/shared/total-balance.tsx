import type { CurrencyCode } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrencyValueText } from '@/components/currency/currency-value-text';

type TotalBalanceProps = {
  label: string;
  value: number | null;
  currency: CurrencyCode;
  isLoading?: boolean;
};

const unavailableTotalBalanceLabel = '--';

/**
 * "TOTAL BALANCE" label + currency value block.
 * Matches the Figma Home frame (31:7140) and the shared Vault Detail
 * balance section (32:1597, 44:5123).
 */
export const TotalBalance = ({
  label,
  value,
  currency,
  isLoading = false
}: TotalBalanceProps) => (
  <div className='flex flex-col gap-2'>
    <p className='type-label text-footer-muted uppercase'>{label}</p>
    {isLoading ? (
      <Skeleton className='h-8 w-44' />
    ) : value === null ? (
      <span className='type-value-xl mb-0 text-footer-muted'>
        {unavailableTotalBalanceLabel}
      </span>
    ) : (
      <CurrencyValueText
        value={value}
        currency={currency}
        className='type-value-xl mb-0'
      />
    )}
  </div>
);
