import { getCurrencyConfig, type CurrencyCode } from '@/lib/currency';

type CurrencyValueTextProps = {
  value: number;
  currency: CurrencyCode;
  className?: string;
  mutedClassName?: string;
  prefix?: string;
};

export const defaultCurrencyValueMutedClassName = 'text-footer-muted';

const mutedCurrencyPartTypes: ReadonlySet<Intl.NumberFormatPartTypes> = new Set(
  ['currency', 'fraction']
);

export const CurrencyValueText = ({
  value,
  currency,
  className,
  mutedClassName = defaultCurrencyValueMutedClassName,
  prefix
}: CurrencyValueTextProps) => {
  const { locale } = getCurrencyConfig(currency);
  const parts = new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    style: 'currency'
  }).formatToParts(value);
  let nextPartOffset = 0;

  return (
    <span className={className}>
      {prefix ? <span className={mutedClassName}>{prefix}</span> : null}
      {parts.map(part => {
        const key = `${part.type}-${nextPartOffset}-${part.value.length}`;
        nextPartOffset += part.value.length;

        if (mutedCurrencyPartTypes.has(part.type)) {
          return (
            <span key={key} className={mutedClassName}>
              {part.value}
            </span>
          );
        }

        return <span key={key}>{part.value}</span>;
      })}
    </span>
  );
};
