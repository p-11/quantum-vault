import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  formatUnits: (value: bigint, decimals: number) =>
    (Number(value) / 10 ** decimals).toString()
}));

import {
  formatBalanceInCurrency,
  minCurrencyDisplayThreshold,
  resolveBalanceInCurrencyDisplay
} from '@/lib/balance-in-currency';

describe('resolveBalanceInCurrencyDisplay', () => {
  it('returns a zero currency value when balance is zero', () => {
    const result = resolveBalanceInCurrencyDisplay({
      balance: 0n,
      decimals: 8,
      assetPrice: undefined
    });

    expect(result).toEqual({ exact: 0 });
  });

  it('returns unavailable when a non-zero balance has no price', () => {
    const result = resolveBalanceInCurrencyDisplay({
      balance: 1n,
      decimals: 8,
      assetPrice: undefined
    });

    expect(result).toEqual({ unavailable: true });
  });

  it('returns a below-threshold marker for tiny priced balances', () => {
    const result = resolveBalanceInCurrencyDisplay({
      balance: 1n,
      decimals: 8,
      assetPrice: 10
    });

    expect(result).toEqual({ belowThreshold: minCurrencyDisplayThreshold });
  });

  it('returns an exact zero display for zero-priced positive balances', () => {
    const result = resolveBalanceInCurrencyDisplay({
      balance: 100_000_000n,
      decimals: 8,
      assetPrice: 0
    });

    expect(result).toEqual({ exact: 0 });
  });
});

describe('formatBalanceInCurrency', () => {
  it('returns currency zero when balance is zero and price is unavailable', () => {
    const result = formatBalanceInCurrency({
      balance: 0n,
      decimals: 8,
      assetPrice: undefined,
      currencyCode: 'usd'
    });

    expect(result).toBe('$0.00');
  });

  it('returns dash when balance is non-zero and price is unavailable', () => {
    const result = formatBalanceInCurrency({
      balance: 1n,
      decimals: 8,
      assetPrice: undefined,
      currencyCode: 'usd'
    });

    expect(result).toBe('—');
  });

  it('returns formatted currency value when balance is non-zero and price is available', () => {
    const result = formatBalanceInCurrency({
      balance: 100_000_000n,
      decimals: 8,
      assetPrice: 85_000,
      currencyCode: 'usd'
    });

    expect(result).toBe('$85,000.00');
  });

  it('returns a prefixed threshold for tiny non-zero values', () => {
    const result = formatBalanceInCurrency({
      balance: 1n,
      decimals: 8,
      assetPrice: 10,
      currencyCode: 'usd'
    });

    expect(result).toBe('< $0.01');
  });

  it('does not prefix values exactly at the display threshold', () => {
    const result = formatBalanceInCurrency({
      balance: 1n,
      decimals: 2,
      assetPrice: 1,
      currencyCode: 'usd'
    });

    expect(result).toBe('$0.01');
  });

  it('formats zero-priced non-zero balances as currency zero', () => {
    const result = formatBalanceInCurrency({
      balance: 100_000_000n,
      decimals: 8,
      assetPrice: 0,
      currencyCode: 'usd'
    });

    expect(result).toBe('$0.00');
  });

  it('preserves non-USD currency formatting for string consumers', () => {
    const result = formatBalanceInCurrency({
      balance: 100_000_000n,
      decimals: 8,
      assetPrice: 10,
      currencyCode: 'eur'
    });

    expect(result).toBe('10,00 €');
  });
});
