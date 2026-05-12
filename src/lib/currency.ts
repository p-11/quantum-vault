const currencyCodes = ['usd', 'eur', 'gbp', 'jpy'] as const;

export type CurrencyCode = (typeof currencyCodes)[number];

const isCurrencyCode = (value: string): value is CurrencyCode =>
  currencyCodes.some(code => code === value);

export type CurrencyConfig = {
  code: CurrencyCode;
  name: string;
  locale: string;
};

const currencyConfigByCode = {
  usd: { name: 'US Dollar', locale: 'en-US' },
  eur: { name: 'Euro', locale: 'de-DE' },
  gbp: { name: 'British Pound', locale: 'en-GB' },
  jpy: { name: 'Japanese Yen', locale: 'ja-JP' }
} satisfies Record<CurrencyCode, Omit<CurrencyConfig, 'code'>>;

export const supportedCurrencies: readonly CurrencyConfig[] = currencyCodes.map(
  code => ({
    code,
    ...currencyConfigByCode[code]
  })
);

export const DEFAULT_CURRENCY: CurrencyCode = 'usd';

const STORAGE_KEY = 'quantum-vault-currency';

export const loadCurrency = (): CurrencyCode => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isCurrencyCode(stored)) {
    return stored;
  }
  return DEFAULT_CURRENCY;
};

export const saveCurrency = (code: CurrencyCode): void => {
  localStorage.setItem(STORAGE_KEY, code);
};

export const getCurrencyConfig = (code: CurrencyCode): CurrencyConfig => ({
  code,
  ...currencyConfigByCode[code]
});

export const formatCurrencyValue = (
  value: number,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY
): string => {
  const config = getCurrencyConfig(currencyCode);
  return value.toLocaleString(config.locale, {
    style: 'currency',
    currency: currencyCode.toLowerCase()
  });
};
