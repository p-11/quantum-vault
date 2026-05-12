import { ActivityType, type Activity } from '@project-eleven/libqc';
import { ensurePresent } from '@/lib/assert';

/**
 * UI-friendly shape rendered by the Activity tab.
 *
 * Blocked by ENG-1709 for accurate timestamps. The mapper returns placeholder
 * values for timestamps today so the UI can be built against the final shape.
 */
export type ActivityRow = {
  id: string;
  direction: 'inbound' | 'outbound';
  counterparty: string;
  amount: bigint;
  symbol: string;
  decimals: number;
  /** `null` when ENG-1709 has not landed. */
  timestamp: number | null;
  /** Populated by the SDK for every activity type; nullable for forward shape compatibility. */
  txRef: string | null;
  blockNumber: bigint | null;
};

export type ActivityAssetMetadata = {
  symbol: string;
  decimals: number;
};

const interfaceActivitySupportByType = {
  [ActivityType.NativeTransaction]: true,
  [ActivityType.Erc20Transaction]: false,
  [ActivityType.BitcoinTransaction]: true
} as const satisfies Record<ActivityType, boolean>;

type InterfaceActivityType = {
  [TActivityType in keyof typeof interfaceActivitySupportByType]: (typeof interfaceActivitySupportByType)[TActivityType] extends true
    ? TActivityType
    : never;
}[keyof typeof interfaceActivitySupportByType];

export type InterfaceActivity = Extract<
  Activity,
  { type: InterfaceActivityType }
>;

export const isInterfaceActivity = (
  activity: Activity
): activity is InterfaceActivity =>
  interfaceActivitySupportByType[activity.type];

export type NativeActivity = Extract<
  Activity,
  { type: ActivityType.NativeTransaction }
>;

export const isNativeActivity = (
  activity: Activity
): activity is NativeActivity =>
  activity.type === ActivityType.NativeTransaction;

type ActivityAssetShape = {
  symbol: string;
  decimals: number;
  entities: ReadonlyArray<{
    assetType: {
      assetName: {
        namespace: string;
        reference: string;
      };
    };
  }>;
};

export const getNativeAssetMetadata = (
  assets: ReadonlyArray<ActivityAssetShape>
): ActivityAssetMetadata | undefined => {
  const nativeAsset = assets.find(asset =>
    asset.entities.some(
      entity => entity.assetType.assetName.namespace === 'slip44'
    )
  );

  if (!nativeAsset) {
    return undefined;
  }

  return {
    symbol: nativeAsset.symbol,
    decimals: nativeAsset.decimals
  };
};

export const getBitcoinAssetMetadata = (
  assets: ReadonlyArray<ActivityAssetShape>
): ActivityAssetMetadata | undefined => {
  const bitcoinAsset = assets.find(asset => asset.symbol === 'BTC');

  if (!bitcoinAsset) {
    return undefined;
  }

  return {
    symbol: bitcoinAsset.symbol,
    decimals: bitcoinAsset.decimals
  };
};

/**
 * Pure mapper: `Activity` (libqc) -> `ActivityRow` (UI).
 *
 * Direction is derived from address equality with the caller's vault
 * address. Caller passes the vault address so this stays pure.
 */
export const mapActivityToRow = ({
  activity,
  vaultAddress,
  assets,
  index
}: {
  activity: InterfaceActivity;
  vaultAddress: string;
  assets: ReadonlyArray<ActivityAssetShape>;
  index: number;
}): ActivityRow => {
  if (activity.type === ActivityType.NativeTransaction) {
    const nativeAsset = ensurePresent(
      getNativeAssetMetadata(assets),
      'native asset metadata for activity row'
    );
    const isOutbound =
      activity.data.from.toLowerCase() === vaultAddress.toLowerCase();

    return {
      id: `native:${activity.blockNumber.toString()}:${index}`,
      direction: isOutbound ? 'outbound' : 'inbound',
      counterparty: isOutbound ? activity.data.to : activity.data.from,
      amount: activity.data.value,
      symbol: nativeAsset.symbol,
      decimals: nativeAsset.decimals,
      timestamp: null,
      txRef: activity.data.txHash,
      blockNumber: activity.blockNumber
    };
  }

  if (activity.type === ActivityType.BitcoinTransaction) {
    const bitcoinAsset = ensurePresent(
      getBitcoinAssetMetadata(assets),
      'bitcoin asset metadata for activity row'
    );
    const isOutbound = activity.data.from
      .map(a => a.toLowerCase())
      .includes(vaultAddress.toLowerCase());
    const inboundCounterparty = ensurePresent(
      activity.data.from[0],
      `bitcoin sender address for tx ${activity.data.txid}`
    );

    return {
      id: `btc:${activity.data.txid}`,
      direction: isOutbound ? 'outbound' : 'inbound',
      counterparty: isOutbound ? activity.data.to : inboundCounterparty,
      amount: activity.data.value,
      symbol: bitcoinAsset.symbol,
      decimals: bitcoinAsset.decimals,
      timestamp: null,
      txRef: activity.data.txid,
      blockNumber: activity.blockNumber
    };
  }

  const unsupportedActivity: never = activity;
  throw new Error(
    `Unsupported interface activity: ${JSON.stringify(unsupportedActivity)}`
  );
};
