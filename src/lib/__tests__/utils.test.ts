import type { Asset, BalanceResult } from '@project-eleven/libqc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  formatUnits: (value: bigint, decimals: number) =>
    (Number(value) / 10 ** decimals).toString(),
  isNativeAsset: (asset: { symbol: string }) =>
    asset.symbol === 'BTC' || asset.symbol === 'ETH'
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const createJsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

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

const createTestAsset = ({
  id,
  symbol,
  decimals
}: {
  id: string;
  symbol: string;
  decimals: number;
}): Asset => {
  const candidate: unknown = {
    id,
    symbol,
    decimals,
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
    throw new Error(`Invalid test asset fixture for symbol ${symbol}`);
  }

  return candidate;
};

const createTestBalance = ({
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
    throw new Error(`Invalid test balance fixture for symbol ${symbol}`);
  }

  return candidate;
};

describe('price request coalescing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    // Required so `getAssetPricesUrl()` resolves under vitest, which does not
    // load `.env` by default. Value is arbitrary - the fetch is mocked.
    vi.stubEnv('VITE_ASSET_PRICES_URL', 'https://prices.test/api');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('coalesces concurrent getAssetPrice calls for the same asset and currency', async () => {
    const deferred = createDeferred<Response>();
    const fetchMock = vi.fn(() => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { getAssetPrice } = await import('@/lib/utils');
    const bitcoinAsset = createTestAsset({
      id: 'asset:btc',
      symbol: 'BTC',
      decimals: 8
    });

    const firstPricePromise = getAssetPrice(bitcoinAsset, 'usd');
    const secondPricePromise = getAssetPrice(bitcoinAsset, 'usd');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferred.resolve(createJsonResponse({ bitcoin: { usd: 101_000 } }));

    await expect(
      Promise.all([firstPricePromise, secondPricePromise])
    ).resolves.toEqual([101_000, 101_000]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent totalCurrencyValue calls for the same price set and currency', async () => {
    const deferred = createDeferred<Response>();
    const fetchMock = vi.fn(() => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { totalCurrencyValue } = await import('@/lib/utils');
    const ethereumAsset = createTestAsset({
      id: 'asset:eth',
      symbol: 'ETH',
      decimals: 18
    });
    const usdCoinAsset = createTestAsset({
      id: 'asset:usdc',
      symbol: 'USDC',
      decimals: 6
    });
    const balances = [
      createTestBalance({
        symbol: 'ETH',
        balance: 1_000_000_000_000_000_000n
      })
    ];

    const firstTotalPromise = totalCurrencyValue(
      [ethereumAsset, usdCoinAsset],
      balances,
      'usd'
    );
    const secondTotalPromise = totalCurrencyValue(
      [usdCoinAsset, ethereumAsset],
      balances,
      'usd'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferred.resolve(
      createJsonResponse({
        ethereum: { usd: 3_000 },
        'usd-coin': { usd: 1 }
      })
    );

    await expect(
      Promise.all([firstTotalPromise, secondTotalPromise])
    ).resolves.toEqual([3_000, 3_000]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('coalesces a concurrent single-asset and bulk request for the same price set', async () => {
    const deferred = createDeferred<Response>();
    const fetchMock = vi.fn(() => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { getAssetPrice, totalCurrencyValue } = await import('@/lib/utils');
    const ethereumAsset = createTestAsset({
      id: 'asset:eth',
      symbol: 'ETH',
      decimals: 18
    });
    const balances = [
      createTestBalance({
        symbol: 'ETH',
        balance: 1_000_000_000_000_000_000n
      })
    ];

    const pricePromise = getAssetPrice(ethereumAsset, 'usd');
    const totalPromise = totalCurrencyValue([ethereumAsset], balances, 'usd');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferred.resolve(createJsonResponse({ ethereum: { usd: 2_500 } }));

    await expect(pricePromise).resolves.toBe(2_500);
    await expect(totalPromise).resolves.toBe(2_500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 0 without fetching prices when all effective balances are zero', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { totalCurrencyValue } = await import('@/lib/utils');
    const ethereumAsset = createTestAsset({
      id: 'asset:eth',
      symbol: 'ETH',
      decimals: 18
    });
    const usdCoinAsset = createTestAsset({
      id: 'asset:usdc',
      symbol: 'USDC',
      decimals: 6
    });
    const balances = [createTestBalance({ symbol: 'ETH', balance: 0n })];

    const result = await totalCurrencyValue(
      [ethereumAsset, usdCoinAsset],
      balances,
      'usd'
    );

    expect(result).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when pricing fails and at least one effective balance is non-zero', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('service unavailable', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { totalCurrencyValue } = await import('@/lib/utils');
    const ethereumAsset = createTestAsset({
      id: 'asset:eth',
      symbol: 'ETH',
      decimals: 18
    });
    const balances = [
      createTestBalance({
        symbol: 'ETH',
        balance: 1_000_000_000_000_000_000n
      })
    ];

    await expect(
      totalCurrencyValue([ethereumAsset], balances, 'usd')
    ).rejects.toThrow('Failed to fetch asset prices: 503 Service Unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not coalesce concurrent requests across different currencies', async () => {
    const usdDeferred = createDeferred<Response>();
    const eurDeferred = createDeferred<Response>();
    const fetchMock = vi.fn((input: unknown) => {
      const url = typeof input === 'string' ? input : String(input);
      return url.includes('vs=eur') ? eurDeferred.promise : usdDeferred.promise;
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getAssetPrice } = await import('@/lib/utils');
    const bitcoinAsset = createTestAsset({
      id: 'asset:btc',
      symbol: 'BTC',
      decimals: 8
    });

    const usdPromise = getAssetPrice(bitcoinAsset, 'usd');
    const eurPromise = getAssetPrice(bitcoinAsset, 'eur');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    usdDeferred.resolve(createJsonResponse({ bitcoin: { usd: 100_000 } }));
    eurDeferred.resolve(createJsonResponse({ bitcoin: { eur: 95_000 } }));

    await expect(Promise.all([usdPromise, eurPromise])).resolves.toEqual([
      100_000, 95_000
    ]);
  });

  it('tolerates a null price for one asset without rejecting concurrent callers of totalCurrencyValue', async () => {
    const deferred = createDeferred<Response>();
    const fetchMock = vi.fn(() => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { totalCurrencyValue } = await import('@/lib/utils');
    const ethereumAsset = createTestAsset({
      id: 'asset:eth',
      symbol: 'ETH',
      decimals: 18
    });
    const usdCoinAsset = createTestAsset({
      id: 'asset:usdc',
      symbol: 'USDC',
      decimals: 6
    });
    const balances = [
      createTestBalance({
        symbol: 'ETH',
        balance: 1_000_000_000_000_000_000n
      })
    ];

    const firstTotalPromise = totalCurrencyValue(
      [ethereumAsset, usdCoinAsset],
      balances,
      'usd'
    );
    const secondTotalPromise = totalCurrencyValue(
      [usdCoinAsset, ethereumAsset],
      balances,
      'usd'
    );

    // Simulates CoinGecko returning `null` for one asset while another
    // resolves normally - the coalesced request must not reject both callers.
    deferred.resolve(
      createJsonResponse({
        ethereum: { usd: 3_000 },
        'usd-coin': { usd: null }
      })
    );

    await expect(
      Promise.all([firstTotalPromise, secondTotalPromise])
    ).resolves.toEqual([3_000, 3_000]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('releases the in-flight slot so a later request issues a fresh fetch after the cache expires', async () => {
    const firstDeferred = createDeferred<Response>();
    const secondDeferred = createDeferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { getAssetPrice } = await import('@/lib/utils');
    const bitcoinAsset = createTestAsset({
      id: 'asset:btc',
      symbol: 'BTC',
      decimals: 8
    });

    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(0);

    const firstPromise = getAssetPrice(bitcoinAsset, 'usd');
    firstDeferred.resolve(createJsonResponse({ bitcoin: { usd: 100_000 } }));
    await expect(firstPromise).resolves.toBe(100_000);

    // Jump past the in-memory price cache TTL so the next call re-fetches.
    dateSpy.mockReturnValue(120_000);

    const secondPromise = getAssetPrice(bitcoinAsset, 'usd');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    secondDeferred.resolve(createJsonResponse({ bitcoin: { usd: 101_000 } }));
    await expect(secondPromise).resolves.toBe(101_000);

    dateSpy.mockRestore();
  });
});

describe('getInterfaceAssets', () => {
  it('splits native interface assets from hidden token assets', async () => {
    const {
      getInterfaceAssets,
      getNonInterfaceAssets,
      getPositiveNonInterfaceAssetBalances
    } = await import('@/lib/utils');
    const ethereumAsset = createTestAsset({
      id: 'asset:eth',
      symbol: 'ETH',
      decimals: 18
    });
    const usdCoinAsset = createTestAsset({
      id: 'asset:usdc',
      symbol: 'USDC',
      decimals: 6
    });
    const daiAsset = createTestAsset({
      id: 'asset:dai',
      symbol: 'DAI',
      decimals: 18
    });

    expect(getInterfaceAssets([ethereumAsset, usdCoinAsset, daiAsset])).toEqual(
      [ethereumAsset]
    );
    expect(
      getNonInterfaceAssets([ethereumAsset, usdCoinAsset, daiAsset])
    ).toEqual([usdCoinAsset, daiAsset]);
    expect(
      getPositiveNonInterfaceAssetBalances({
        assets: [ethereumAsset, usdCoinAsset, daiAsset],
        balances: [
          createTestBalance({
            symbol: 'ETH',
            balance: 1_000_000_000_000_000_000n
          }),
          createTestBalance({
            symbol: 'USDC',
            balance: 1_000_000n
          }),
          createTestBalance({
            symbol: 'DAI',
            balance: 0n
          })
        ]
      })
    ).toEqual([
      {
        asset: usdCoinAsset,
        balance: createTestBalance({
          symbol: 'USDC',
          balance: 1_000_000n
        })
      }
    ]);
  });
});
