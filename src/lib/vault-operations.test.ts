import type {
  Asset,
  BalanceResult,
  PersistedAccount
} from '@project-eleven/libqc';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  EvmAccountClient: class EvmAccountClient {},
  InsufficientNativeBalanceForGasError: class InsufficientNativeBalanceForGasError extends Error {},
  InvalidDestinationAddressError: class InvalidDestinationAddressError extends Error {},
  NoWithdrawableAssetsError: class NoWithdrawableAssetsError extends Error {},
  formatUnits: (value: bigint) => value.toString(),
  isNativeAsset: (asset: { symbol: string }) =>
    asset.symbol === 'BTC' || asset.symbol === 'ETH'
}));

import {
  InvalidDestinationAddressError,
  NoWithdrawableAssetsError
} from '@project-eleven/libqc';

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

  describe('Bitcoin fee estimation outcomes', () => {
    const bitcoinAsset = createAsset('BTC');
    const bitcoinDestination = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

    const createBitcoinVault = (
      estimateEmptyVaultFee: (destination: string) => Promise<bigint>
    ) => ({
      getAccount: async () => ({
        listAssets: async () => [bitcoinAsset],
        getBalances: async () => [
          createBalance({ symbol: 'BTC', balance: 1_000n })
        ],
        estimateEmptyVaultFee
      })
    });

    it('reports the estimated fee when estimation succeeds', async () => {
      const estimateEmptyVaultFee = vi.fn(async () => 450n);

      await expect(
        loadVaultWithdrawSummary(
          createBitcoinVault(estimateEmptyVaultFee),
          createAccount(),
          bitcoinDestination
        )
      ).resolves.toEqual({
        status: 'ready',
        items: [
          {
            asset: bitcoinAsset,
            balance: createBalance({ symbol: 'BTC', balance: 1_000n })
          }
        ],
        estimatedFee: '~450 BTC'
      });
      expect(estimateEmptyVaultFee).toHaveBeenCalledWith(bitcoinDestination);
    });

    it('blocks the review when the SDK rejects the destination address', async () => {
      await expect(
        loadVaultWithdrawSummary(
          createBitcoinVault(async destination => {
            throw new InvalidDestinationAddressError(destination);
          }),
          createAccount(),
          '0x8ba1f109551bD432803012645Ac136ddd64DBA72'
        )
      ).resolves.toEqual({ status: 'invalid-destination' });
    });

    it('blocks the review when nothing spendable remains after fees', async () => {
      await expect(
        loadVaultWithdrawSummary(
          createBitcoinVault(async () => {
            throw new NoWithdrawableAssetsError('account-1');
          }),
          createAccount(),
          bitcoinDestination
        )
      ).resolves.toEqual({ status: 'insufficient-for-fee' });
    });

    it('keeps the review confirmable with an unknown fee on transient estimate failures', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      await expect(
        loadVaultWithdrawSummary(
          createBitcoinVault(async () => {
            throw new Error('fee provider unavailable');
          }),
          createAccount(),
          bitcoinDestination
        )
      ).resolves.toMatchObject({ status: 'ready', estimatedFee: null });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });
  });
});
