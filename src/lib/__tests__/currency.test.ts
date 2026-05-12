import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CURRENCY,
  loadCurrency,
  supportedCurrencies
} from '@/lib/currency';

describe('supportedCurrencies', () => {
  it('exposes the ENG-1808 currency set', () => {
    expect(supportedCurrencies.map(currency => currency.code)).toEqual([
      'usd',
      'eur',
      'gbp',
      'jpy'
    ]);
  });
});

describe('loadCurrency', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the default for legacy stored currency values', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'cad')
    });

    expect(loadCurrency()).toBe(DEFAULT_CURRENCY);
  });
});
