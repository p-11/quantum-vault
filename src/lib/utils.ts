import {
  formatUnits,
  isNativeAsset as isNativeAssetEntity,
  type Asset,
  type BalanceResult
} from '@project-eleven/libqc';
import { clsx, type ClassValue } from 'clsx';
import type { RefObject } from 'react';
import { twMerge } from 'tailwind-merge';
import { withInFlightCoalescer } from './async';
import type { CurrencyCode } from './currency';
import { getAssetPricesUrl } from './env';

/**
 * CoinGecko API response type
 */
type CoinGeckoPriceResponse = Record<
  string,
  {
    usd?: number;
    eur?: number;
    gbp?: number;
    cad?: number;
    chf?: number;
    jpy?: number;
    cny?: number;
    aud?: number;
    hkd?: number;
    nzd?: number;
  }
>;

const coinGeckoCurrencies = [
  'usd',
  'eur',
  'gbp',
  'cad',
  'chf',
  'jpy',
  'cny',
  'aud',
  'hkd',
  'nzd'
] as const;

/**
 * CoinGecko ID to symbol mapping for supported assets.
 * Unmapped symbols are treated as unsupported and return price 0 to avoid crashes.
 */
const COINGECKO_SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  stETH: 'staked-ether',
  wBTC: 'wrapped-bitcoin',
  wETH: 'weth',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  LINK: 'chainlink',
  '1INCH': '1inch'
};

/** TTL for price cache in milliseconds (1 minute). */
export const priceCacheTtlMs = 60_000;

/** In-memory cache for asset prices: key = `${symbol}-${currencyCode}` */
const priceCache = new Map<string, { price: number; timestamp: number }>();

type FetchAssetPricesInput = {
  coingeckoIds: readonly string[];
  currencyCode: CurrencyCode;
};

// Sort + dedupe so callers that pass the same ids in any order share one
// in-flight request. Centralizing this here keeps the coalescing invariant
// intact even if a future caller forgets to canonicalize upstream.
const toCanonicalCoinGeckoIds = (ids: readonly string[]): readonly string[] =>
  [...new Set(ids)].sort();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseCoinGeckoPriceResponse = (
  value: unknown
): CoinGeckoPriceResponse => {
  if (!isRecord(value)) {
    throw new Error('Invalid CoinGecko response: expected object payload');
  }

  const parsed: CoinGeckoPriceResponse = {};

  for (const [id, idPrices] of Object.entries(value)) {
    if (!isRecord(idPrices)) {
      throw new Error(
        `Invalid CoinGecko response: expected object for id ${id}`
      );
    }

    const parsedPrices: CoinGeckoPriceResponse[string] = {};
    for (const currency of coinGeckoCurrencies) {
      const rawPrice = idPrices[currency];
      // Skip missing or non-numeric prices (e.g., CoinGecko returns `null`
      // when a price is momentarily unavailable for an asset). Tolerating
      // per-field preserves the pre-coalescing graceful-degradation
      // behavior: one asset with a bad price must not reject price reads
      // for every concurrent caller sharing the in-flight request.
      if (typeof rawPrice !== 'number' || !Number.isFinite(rawPrice)) {
        continue;
      }
      parsedPrices[currency] = rawPrice;
    }

    parsed[id] = parsedPrices;
  }

  return parsed;
};

const getCoalescedPriceRequestKey = ({
  coingeckoIds,
  currencyCode
}: FetchAssetPricesInput): string =>
  `${currencyCode}:${toCanonicalCoinGeckoIds(coingeckoIds).join(',')}`;

const fetchAssetPrices = withInFlightCoalescer(
  async ({
    coingeckoIds,
    currencyCode
  }: FetchAssetPricesInput): Promise<CoinGeckoPriceResponse> => {
    const canonicalIds = toCanonicalCoinGeckoIds(coingeckoIds);
    const response = await fetch(
      `${getAssetPricesUrl()}?ids=${canonicalIds.join(',')}&vs=${currencyCode}`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch asset prices: ${response.status} ${response.statusText}`
      );
    }

    return parseCoinGeckoPriceResponse(await response.json());
  },
  {
    getKey: getCoalescedPriceRequestKey
  }
);

/**
 * Best-effort wipe of sensitive data carried by a `Uint8Array` or backing a
 * sensitive DOM input.
 */
export function zeroOut(buffer: Uint8Array | null | undefined): void;
export function zeroOut(ref: RefObject<Uint8Array | null | undefined>): void;
export function zeroOut(
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
): void;
export function zeroOut(
  target:
    | Uint8Array
    | null
    | undefined
    | RefObject<Uint8Array | null | undefined>
    | RefObject<HTMLInputElement | HTMLTextAreaElement | null>
): void {
  const value = target instanceof Uint8Array ? target : target?.current;
  if (value == null) {
    return;
  }

  if (value instanceof Uint8Array) {
    value.fill(0);
    return;
  }

  value.value = '';
}

export const clearSecretRef = (secretRef: RefObject<Uint8Array>): void => {
  zeroOut(secretRef);
  secretRef.current = new Uint8Array();
};

export const replaceSecretRef = (
  secretRef: RefObject<Uint8Array>,
  nextValue: Uint8Array
): void => {
  zeroOut(secretRef);
  secretRef.current = nextValue;
};

export const clearOptionalSecretRef = <T extends Uint8Array>(
  secretRef: RefObject<T | undefined>
): void => {
  zeroOut(secretRef.current);
  secretRef.current = undefined;
};

export const replaceZeroedRef = <T extends Uint8Array>(
  secretRef: RefObject<T | undefined>,
  nextValue: T
): void => {
  zeroOut(secretRef.current);
  secretRef.current = nextValue;
};

export const areEqualBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    const leftByte = index < left.length ? left[index] : 0;
    const rightByte = index < right.length ? right[index] : 0;
    diff |= leftByte ^ rightByte;
  }

  return diff === 0;
};

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/**
 * P11TODO: unit test
 */
export const shortenAddress = (
  address: string | readonly string[],
  chars: number = 6
): string => {
  const normalizedAddress = Array.isArray(address)
    ? (address[0] ?? '')
    : address;

  if (normalizedAddress.startsWith('0x')) {
    return `${normalizedAddress.slice(0, 2 + chars)}...${normalizedAddress.slice(-chars)}`;
  }
  return `${normalizedAddress.slice(0, chars)}...${normalizedAddress.slice(-chars)}`;
};

/**
 * Builds a regex allowing up to {decimals} digits after the decimal point.
 *
 * P11TODO: unit test
 */
export const getValidNumericInputPattern = (decimals: number): RegExp =>
  new RegExp(`^\\d*(?:\\.\\d{0,${decimals}})?$`);

export const currencyValueInputPattern = getValidNumericInputPattern(2);

/**
 * Fetches the current price of an asset in the specified currency.
 * Results are cached in memory for 1 minute to reduce API calls.
 */
export const getAssetPrice = async (
  asset: Asset,
  currencyCode: CurrencyCode = 'usd'
): Promise<number> => {
  const coingeckoId = COINGECKO_SYMBOL_TO_ID[asset.symbol];
  if (coingeckoId === undefined) {
    return 0;
  }

  const cacheKey = `${asset.symbol}-${currencyCode}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < priceCacheTtlMs) {
    return cached.price;
  }

  const data = await fetchAssetPrices({
    coingeckoIds: [coingeckoId],
    currencyCode
  });
  const price = data[coingeckoId]?.[currencyCode];
  if (price === undefined || price === null) {
    throw new Error(
      `Invalid price data for ${asset.symbol}: missing or invalid price`
    );
  }

  priceCache.set(cacheKey, { price, timestamp: Date.now() });
  return price;
};

/**
 * Fetches prices for multiple assets in a single HTTP request.
 * Populates the price cache for subsequent getAssetPrice calls.
 * Returns a Map of asset symbol to price (0 for unmapped or missing).
 */
const getAssetPricesBulk = async (
  assets: Array<Asset>,
  currencyCode: CurrencyCode = 'usd'
): Promise<Map<string, number>> => {
  const symbolToId = new Map<string, string>();
  const uncachedIds: string[] = [];
  const now = Date.now();

  for (const asset of assets) {
    const id = COINGECKO_SYMBOL_TO_ID[asset.symbol];
    if (id === undefined) {
      symbolToId.set(asset.symbol, '');
      continue;
    }
    symbolToId.set(asset.symbol, id);
    const cacheKey = `${asset.symbol}-${currencyCode}`;
    const cached = priceCache.get(cacheKey);
    if (!cached || now - cached.timestamp >= priceCacheTtlMs) {
      uncachedIds.push(id);
    }
  }

  const uniqueUncachedIds = [...new Set(uncachedIds)];

  if (uniqueUncachedIds.length > 0) {
    const fetchedIds = new Set(uniqueUncachedIds);
    const data = await fetchAssetPrices({
      coingeckoIds: uniqueUncachedIds,
      currencyCode
    });
    for (const [symbol, id] of symbolToId) {
      if (id === '' || !fetchedIds.has(id)) continue;
      const price = data[id]?.[currencyCode];
      const cacheKey = `${symbol}-${currencyCode}`;
      if (price !== undefined && price !== null) {
        priceCache.set(cacheKey, { price, timestamp: now });
      }
    }
  }

  const result = new Map<string, number>();
  for (const asset of assets) {
    const id = symbolToId.get(asset.symbol);
    if (id === undefined || id === '') {
      result.set(asset.symbol, 0);
      continue;
    }
    const cacheKey = `${asset.symbol}-${currencyCode}`;
    const cached = priceCache.get(cacheKey);
    result.set(asset.symbol, cached?.price ?? 0);
  }
  return result;
};

export const isNativeAsset = (asset: Asset) =>
  asset.entities.some(entity =>
    isNativeAssetEntity(asset, entity.assetType.chainId)
  );

export const getInterfaceAssets = <TAsset extends Asset>(
  assets: ReadonlyArray<TAsset>
): Array<TAsset> => assets.filter(isNativeAsset);

export const getNonInterfaceAssets = <TAsset extends Asset>(
  assets: ReadonlyArray<TAsset>
): Array<TAsset> => assets.filter(asset => !isNativeAsset(asset));

export type AssetBalanceItem<TAsset extends Asset = Asset> = {
  asset: TAsset;
  balance: BalanceResult;
};

export const getPositiveNonInterfaceAssetBalances = <TAsset extends Asset>({
  assets,
  balances
}: {
  assets: ReadonlyArray<TAsset>;
  balances: ReadonlyArray<BalanceResult>;
}): Array<AssetBalanceItem<TAsset>> => {
  const balanceBySymbol = new Map(
    balances.map(balance => [balance.symbol, balance])
  );

  return getNonInterfaceAssets(assets).flatMap(asset => {
    const balance = balanceBySymbol.get(asset.symbol);

    if (balance === undefined || balance.balance <= 0n) {
      return [];
    }

    return [{ asset, balance }];
  });
};

export const formatAssetBalance = (balance: bigint, asset: Asset) => {
  return `${formatUnits(balance, asset.decimals)} ${asset.symbol}`;
};

export const totalCurrencyValue = async (
  assets: Array<Asset>,
  balances: Array<BalanceResult>,
  currencyCode: CurrencyCode = 'usd'
) => {
  const getEffectiveBalance = (asset: Asset): bigint =>
    balances.find(item => item.symbol === asset.symbol)?.balance ?? 0n;

  const hasPositiveBalance = assets.some(
    asset => getEffectiveBalance(asset) > 0n
  );
  if (!hasPositiveBalance) {
    return 0;
  }

  const priceMap = await getAssetPricesBulk(assets, currencyCode);
  let total = 0;
  for (const asset of assets) {
    const balance = getEffectiveBalance(asset);
    const price = priceMap.get(asset.symbol) ?? 0;
    total += Number(formatUnits(balance, asset.decimals)) * price;
  }
  return total;
};
