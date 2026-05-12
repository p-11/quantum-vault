import type {
  Asset,
  BalanceResult,
  PersistedAccount
} from '@project-eleven/libqc';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  EvmAccountClient: class EvmAccountClient {},
  formatUnits: (value: bigint) => value.toString(),
  isNativeAsset: (asset: { symbol: string }) =>
    asset.symbol === 'BTC' || asset.symbol === 'ETH'
}));

import {
  NonInterfaceAssetBalanceError,
  assertNoNonInterfaceAssetBalances,
  loadVaultWithdrawSummary
} from '@/lib/vault-operations';

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

const isPersistedAccount = (value: unknown): value is PersistedAccount => {
  if (!isRecord(value)) {
    return false;
  }

  return 'id' in value;
};

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
  const candidate: unknown = {
    symbol,
    balance
  };

  if (!isBalanceResult(candidate)) {
    throw new Error(`Invalid balance fixture for ${symbol}`);
  }

  return candidate;
};

const createAccount = (): PersistedAccount => {
  const candidate: unknown = {
    id: 'account-1'
  };

  if (!isPersistedAccount(candidate)) {
    throw new Error('Invalid account fixture');
  }

  return candidate;
};

describe('vault operations', () => {
  it('blocks withdrawal summary when hidden token balances are present', async () => {
    const ethereumAsset = createAsset('ETH');
    const usdCoinAsset = createAsset('USDC');
    const getTransferGasCostEstimate = vi.fn();

    const summary = await loadVaultWithdrawSummary(
      {
        getAccount: async () => ({
          listAssets: async () => [ethereumAsset, usdCoinAsset],
          getBalances: async () => [
            createBalance({ symbol: 'ETH', balance: 1n }),
            createBalance({ symbol: 'USDC', balance: 1_000_000n })
          ],
          getTransferGasCostEstimate
        })
      },
      createAccount(),
      '0x1111111111111111111111111111111111111111'
    );

    expect(summary).toEqual({ status: 'unsupported-assets' });
    expect(getTransferGasCostEstimate).not.toHaveBeenCalled();
  });

  it('fails fast before empty-vault execution when hidden token balances are present', async () => {
    const ethereumAsset = createAsset('ETH');
    const usdCoinAsset = createAsset('USDC');

    await expect(
      assertNoNonInterfaceAssetBalances(
        {
          getAccount: async () => ({
            listAssets: async () => [ethereumAsset, usdCoinAsset],
            getBalances: async () => [
              createBalance({ symbol: 'ETH', balance: 1n }),
              createBalance({ symbol: 'USDC', balance: 1_000_000n })
            ]
          })
        },
        createAccount()
      )
    ).rejects.toBeInstanceOf(NonInterfaceAssetBalanceError);
  });
});
