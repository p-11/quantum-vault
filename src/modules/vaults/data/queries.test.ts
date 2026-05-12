import type { Activity, Asset, BalanceResult } from '@project-eleven/libqc';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  ActivityType: {
    BitcoinTransaction: 'BitcoinTransaction',
    Erc20Transaction: 'Erc20Transaction',
    NativeTransaction: 'NativeTransaction'
  },
  formatUnits: (value: bigint) => value.toString(),
  isNativeAsset: (asset: { symbol: string }) =>
    asset.symbol === 'BTC' || asset.symbol === 'ETH'
}));

vi.mock('@/lib/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();

  return {
    ...actual,
    totalCurrencyValue: vi.fn()
  };
});

import { totalCurrencyValue } from '@/lib/utils';
import {
  loadAccountData,
  loadVaultDetailData
} from '@/modules/vaults/data/queries';

const mockedTotalCurrencyValue = vi.mocked(totalCurrencyValue);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAsset = (value: unknown): value is Asset => {
  if (!isRecord(value)) {
    return false;
  }

  const { id, symbol, decimals, name, iconUrl, entities } = value;
  return (
    typeof id === 'string' &&
    typeof symbol === 'string' &&
    typeof decimals === 'number' &&
    typeof name === 'string' &&
    typeof iconUrl === 'string' &&
    Array.isArray(entities)
  );
};

const isBalanceResult = (value: unknown): value is BalanceResult => {
  if (!isRecord(value)) {
    return false;
  }

  const { symbol, balance } = value;
  return typeof symbol === 'string' && typeof balance === 'bigint';
};

const isActivity = (value: unknown): value is Activity =>
  isRecord(value) && typeof value.type === 'string';

const createAsset = (symbol: string): Asset => {
  const candidate: unknown = {
    id: `asset:${symbol.toLowerCase()}`,
    symbol,
    decimals: symbol === 'USDC' ? 6 : 18,
    name: symbol,
    iconUrl: `https://example.com/${symbol.toLowerCase()}.png`,
    entities: [
      {
        assetType: {
          chainId: {
            namespace: 'eip155',
            reference: '1'
          }
        }
      }
    ]
  };

  if (!isAsset(candidate)) {
    throw new Error(`Invalid asset fixture for ${symbol}`);
  }

  return candidate;
};

const createBalance = ({
  symbol,
  balance
}: {
  symbol: string;
  balance: bigint;
}): BalanceResult => {
  const candidate: unknown = { symbol, balance };

  if (!isBalanceResult(candidate)) {
    throw new Error(`Invalid balance fixture for ${symbol}`);
  }

  return candidate;
};

const createActivity = (
  type: 'Erc20Transaction' | 'NativeTransaction'
): Activity => {
  const candidate: unknown = { type };

  if (!isActivity(candidate)) {
    throw new Error(`Invalid activity fixture for ${type}`);
  }

  return candidate;
};

describe('vault data queries', () => {
  it('loads account data from account client methods', async () => {
    mockedTotalCurrencyValue.mockResolvedValueOnce(17);

    const vault = {
      getAccount: async () => ({
        listAssets: async () => [],
        getConfig: async () => ({ network: 'test' }),
        getActivities: async () => [],
        getBalances: async () => [],
        getStatus: async () => 'safe'
      })
    };

    const data = await loadAccountData({
      accountId: 'account-1',
      currency: 'usd',
      vault
    });

    expect(data).toEqual({
      assets: [],
      balances: [],
      activities: [],
      config: { network: 'test' },
      totalCurrencyValue: 17
    });
  });

  it('filters account assets, balances, totals, and ERC-20 activities to interface data', async () => {
    mockedTotalCurrencyValue.mockResolvedValueOnce(23);

    const ethereumAsset = createAsset('ETH');
    const usdCoinAsset = createAsset('USDC');
    const ethereumBalance = createBalance({ symbol: 'ETH', balance: 1n });
    const nativeActivity = createActivity('NativeTransaction');
    const erc20Activity = createActivity('Erc20Transaction');
    const getBalances = vi.fn(async () => [ethereumBalance]);

    const data = await loadAccountData({
      accountId: 'account-1',
      currency: 'usd',
      vault: {
        getAccount: async () => ({
          listAssets: async () => [ethereumAsset, usdCoinAsset],
          getConfig: async () => ({ network: 'test' }),
          getActivities: async () => [nativeActivity, erc20Activity],
          getBalances,
          getStatus: async () => 'safe'
        })
      }
    });

    expect(getBalances).toHaveBeenCalledWith([ethereumAsset]);
    expect(mockedTotalCurrencyValue).toHaveBeenCalledWith(
      [ethereumAsset],
      [ethereumBalance],
      'usd'
    );
    expect(data).toEqual({
      assets: [ethereumAsset],
      balances: [ethereumBalance],
      activities: [nativeActivity],
      config: { network: 'test' },
      totalCurrencyValue: 23
    });
  });

  it('loads vault detail data including vault status', async () => {
    mockedTotalCurrencyValue.mockResolvedValueOnce(9);

    const vault = {
      getAccount: async () => ({
        listAssets: async () => [],
        getConfig: async () => ({ network: 'test' }),
        getActivities: async () => [],
        getBalances: async () => [],
        getStatus: async () => 'vulnerable'
      })
    };

    const data = await loadVaultDetailData({
      accountId: 'account-1',
      currency: 'usd',
      vault
    });

    expect(data).toEqual({
      assets: [],
      balances: [],
      totalCurrencyValue: 9,
      vaultState: 'vulnerable'
    });
  });

  it('filters vault detail assets, balances, and totals to interface data', async () => {
    mockedTotalCurrencyValue.mockResolvedValueOnce(31);

    const ethereumAsset = createAsset('ETH');
    const usdCoinAsset = createAsset('USDC');
    const ethereumBalance = createBalance({ symbol: 'ETH', balance: 1n });
    const getBalances = vi.fn(async () => [ethereumBalance]);

    const data = await loadVaultDetailData({
      accountId: 'account-1',
      currency: 'usd',
      vault: {
        getAccount: async () => ({
          listAssets: async () => [ethereumAsset, usdCoinAsset],
          getConfig: async () => ({ network: 'test' }),
          getActivities: async () => [],
          getBalances,
          getStatus: async () => 'vulnerable'
        })
      }
    });

    expect(getBalances).toHaveBeenCalledWith([ethereumAsset]);
    expect(mockedTotalCurrencyValue).toHaveBeenCalledWith(
      [ethereumAsset],
      [ethereumBalance],
      'usd'
    );
    expect(data).toEqual({
      assets: [ethereumAsset],
      balances: [ethereumBalance],
      totalCurrencyValue: 31,
      vaultState: 'vulnerable'
    });
  });
});
