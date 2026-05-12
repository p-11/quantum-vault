import {
  formatUnits,
  type BalanceResult,
  type PersistedAccount
} from '@project-eleven/libqc';

import { ensurePresent, isOneOf } from '@/lib/assert';
import { getVaultName, vaultDetailCopy } from '@/lib/copy';
import { match } from '@/lib/match';
import { shortenAddress } from '@/lib/utils';
import type { VaultStatus } from '@/modules/vaults/core';
import type { ActivityRow } from '@/modules/vaults/data/mappers/activity';
import {
  buildAccountChainByReference,
  getVaultNumberByAccountId,
  type SupportedChainShape
} from '@/modules/vaults/data/mappers/vault';
import { getNativeAssetMetadata } from '@/modules/vaults/data/mappers/activity';
import {
  withdrawalLifecycleKinds,
  type VaultLifecycleKind,
  type WithdrawalLifecycleKind
} from '@/modules/vaults/lifecycle/core';
import type { VaultLifecycleStatus } from '@/modules/vaults/lifecycle/types';

import type {
  ActivityAmountInput,
  ActivityDateLabelInput,
  VaultTabId,
  VaultTitleInput
} from './types';

export const vaultTabs: ReadonlyArray<{ id: VaultTabId; label: string }> = [
  { id: 'funds', label: vaultDetailCopy.tabFunds },
  { id: 'activity', label: vaultDetailCopy.tabActivity }
];

type VaultStatusCurrencyClassNames = {
  valueClassName: string;
  mutedValueClassName: string;
};

export const vaultStatusToCurrencyClassNames: Record<
  VaultStatus,
  VaultStatusCurrencyClassNames
> = {
  safe: {
    valueClassName: 'text-foreground',
    mutedValueClassName: 'text-footer-muted'
  },
  vulnerable: {
    valueClassName: 'text-destructive',
    mutedValueClassName: 'text-destructive'
  },
  withdrawn: {
    valueClassName: 'text-footer-muted',
    mutedValueClassName: 'text-footer-muted'
  }
};

export const getVaultTitle = ({
  selectedAccount,
  accounts,
  supportedChains
}: VaultTitleInput): string => {
  const accountChainByReference = buildAccountChainByReference(supportedChains);
  const vaultNumberByAccountId = getVaultNumberByAccountId(accounts);
  const selectedAccountId = selectedAccount.id.toString();

  const chainMetadata = ensurePresent(
    accountChainByReference[selectedAccount.chainId.reference],
    `chain metadata for ${selectedAccount.chainId.reference}`
  );
  const vaultNumber = ensurePresent(
    vaultNumberByAccountId[selectedAccountId],
    `vault number for account ${selectedAccountId}`
  );

  return getVaultName({
    chainName: chainMetadata.name,
    vaultNumber
  });
};

type VaultAddressLookupKeyInput = {
  chainId: PersistedAccount['chainId'];
  address: string;
};

const evmChainNamespace = 'eip155';
const bitcoinChainNamespace = 'bip122';
const vaultAddressLookupNamespaces = [
  evmChainNamespace,
  bitcoinChainNamespace
] as const;
type VaultAddressLookupNamespace =
  (typeof vaultAddressLookupNamespaces)[number];

const vaultAddressNormalizerByNamespace: Record<
  VaultAddressLookupNamespace,
  (address: string) => string
> = {
  [evmChainNamespace]: address => address.toLowerCase(),
  [bitcoinChainNamespace]: address => address
};

const normalizeVaultAddressForLookup = ({
  chainNamespace,
  address
}: {
  chainNamespace: string;
  address: string;
}): string => {
  if (!isOneOf(chainNamespace, vaultAddressLookupNamespaces)) {
    throw new Error(
      `Unsupported vault address lookup namespace "${chainNamespace}"`
    );
  }

  return vaultAddressNormalizerByNamespace[chainNamespace](address);
};

export const getVaultAddressLookupKey = ({
  chainId,
  address
}: VaultAddressLookupKeyInput): string =>
  `${chainId.namespace}:${chainId.reference}:${normalizeVaultAddressForLookup({
    chainNamespace: chainId.namespace,
    address
  })}`;

export const getVaultLabelByLookupKey = ({
  accounts,
  supportedChains,
  chainId
}: {
  accounts: ReadonlyArray<PersistedAccount>;
  supportedChains: ReadonlyArray<SupportedChainShape>;
  chainId: PersistedAccount['chainId'];
}): Record<string, string> => {
  const accountChainByReference = buildAccountChainByReference(supportedChains);
  const vaultNumberByAccountId = getVaultNumberByAccountId(accounts);
  const labelByLookupKey: Record<string, string> = {};

  for (const account of accounts) {
    if (
      account.chainId.namespace !== chainId.namespace ||
      account.chainId.reference !== chainId.reference
    ) {
      continue;
    }

    const accountId = account.id.toString();
    const chainMetadata = ensurePresent(
      accountChainByReference[account.chainId.reference],
      `chain metadata for ${account.chainId.reference}`
    );
    const vaultNumber = ensurePresent(
      vaultNumberByAccountId[accountId],
      `vault number for account ${accountId}`
    );

    const lookupKey = getVaultAddressLookupKey({
      chainId: account.chainId,
      address: account.address
    });
    labelByLookupKey[lookupKey] = getVaultName({
      chainName: chainMetadata.name,
      vaultNumber
    });
  }

  return labelByLookupKey;
};

type WithdrawalLifecycleStatus = Extract<
  VaultLifecycleStatus,
  { kind: WithdrawalLifecycleKind }
>;

const hasWithdrawalLifecycleData = (
  lifecycleStatus: VaultLifecycleStatus
): lifecycleStatus is WithdrawalLifecycleStatus =>
  isOneOf(lifecycleStatus.kind, withdrawalLifecycleKinds);

export const getLifecycleDestinationAddress = (
  lifecycleStatus: VaultLifecycleStatus
): string | null => {
  if (!hasWithdrawalLifecycleData(lifecycleStatus)) {
    return null;
  }

  return lifecycleStatus.destinationAddress;
};

export const getLifecyclePrimaryTxRef = (
  lifecycleStatus: VaultLifecycleStatus
): string | null => {
  if (!hasWithdrawalLifecycleData(lifecycleStatus)) {
    return null;
  }

  // `emptyVault()` records tx refs in submission order; the first ref anchors the primary explorer CTA.
  return lifecycleStatus.txRefs[0] ?? null;
};

/**
 * A `withdrawn` lifecycle without a backing `WithdrawalRecord`. Produced by
 * the lifecycle adapter for recovered exposed-empty vaults: the public key is
 * exposed onchain and there are no funds left, but we have no proof the user
 * authored the drain. We must NOT borrow `latestOutboundActivity` metadata in
 * this state - the latest outbound is plausibly the attacker's drain, and
 * surfacing it as the user's "withdrawal destination" would mislead them.
 */
export const isRecordlessWithdrawnLifecycle = (
  lifecycleStatus: VaultLifecycleStatus
): boolean =>
  lifecycleStatus.kind === 'withdrawn' &&
  lifecycleStatus.destinationAddress === null &&
  lifecycleStatus.txRefs.length === 0;

export const resolveLifecycleDestinationAddress = ({
  lifecycleStatus,
  fallbackDestinationAddress
}: {
  lifecycleStatus: VaultLifecycleStatus;
  fallbackDestinationAddress: string | null;
}): string | null =>
  getLifecycleDestinationAddress(lifecycleStatus) ?? fallbackDestinationAddress;

export const resolveLifecycleTxRef = ({
  lifecycleStatus,
  fallbackTxRef
}: {
  lifecycleStatus: VaultLifecycleStatus;
  fallbackTxRef: string | null;
}): string | null => getLifecyclePrimaryTxRef(lifecycleStatus) ?? fallbackTxRef;

export const resolveLifecycleDestinationLabel = ({
  destinationAddress,
  vaultLabelByLookupKey,
  selectedChainId
}: {
  destinationAddress: string;
  vaultLabelByLookupKey: Record<string, string>;
  selectedChainId: PersistedAccount['chainId'];
}): string => {
  const lookupKey = getVaultAddressLookupKey({
    chainId: selectedChainId,
    address: destinationAddress
  });
  const matchedVaultLabel = vaultLabelByLookupKey[lookupKey];

  if (matchedVaultLabel === undefined) {
    return shortenAddress(destinationAddress);
  }

  return `${matchedVaultLabel} (${shortenAddress(destinationAddress)})`;
};

export type SuccessLifecycleKind = Extract<
  VaultLifecycleKind,
  'sent' | 'withdrawn'
>;

export type SuccessStateIconKind = 'check' | 'withdraw-to-safe';

const sentSuccessIconKindByOnChainVaultStatus: Record<
  VaultStatus,
  SuccessStateIconKind
> = {
  safe: 'check',
  vulnerable: 'withdraw-to-safe',
  withdrawn: 'check'
};

export const resolveSuccessStateIconKind = ({
  lifecycleKind,
  onChainVaultStatus
}: {
  lifecycleKind: SuccessLifecycleKind;
  onChainVaultStatus: VaultStatus;
}): SuccessStateIconKind =>
  match(lifecycleKind, {
    sent: () => sentSuccessIconKindByOnChainVaultStatus[onChainVaultStatus],
    withdrawn: () => 'check'
  });

export const resolveActivityDateLabel = ({
  timestamp,
  blockNumber
}: ActivityDateLabelInput): string => {
  if (timestamp !== null) {
    const timestampMs =
      timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
    return new Date(timestampMs).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  if (blockNumber !== null) {
    return `Block ${blockNumber.toString()}`;
  }

  return 'Pending';
};

export const formatActivityAmount = ({
  amount,
  decimals
}: ActivityAmountInput): string =>
  Number(formatUnits(amount, decimals)).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 4
  });

export const buildBalanceBySymbol = (
  balances: ReadonlyArray<BalanceResult>
): Record<string, bigint> => {
  const balanceBySymbol: Record<string, bigint> = {};

  for (const balance of balances) {
    balanceBySymbol[balance.symbol] = balance.balance;
  }

  return balanceBySymbol;
};

export const withdrawAvailabilityNamespaces = vaultAddressLookupNamespaces;
export type WithdrawAvailabilityNamespace =
  (typeof withdrawAvailabilityNamespaces)[number];

const ethWithdrawThresholdWei = 1_000_000_000_000_000n; // 0.001 ETH
const bitcoinWithdrawThresholdSats = 900n;

export const withdrawNativeBalanceThresholdByNamespace: Record<
  WithdrawAvailabilityNamespace,
  bigint
> = {
  [evmChainNamespace]: ethWithdrawThresholdWei,
  [bitcoinChainNamespace]: bitcoinWithdrawThresholdSats
};

export type WithdrawDisabledMessageByNamespace = Record<
  WithdrawAvailabilityNamespace,
  string
>;

export type WithdrawAvailability =
  | { kind: 'hidden' }
  | {
      kind: 'disabled';
      message: string;
    }
  | { kind: 'enabled' };

type WithdrawAvailabilityBalanceState = 'zero' | 'below-threshold' | 'enough';

const resolveWithdrawAvailabilityBalanceState = ({
  nativeBalance,
  threshold
}: {
  nativeBalance: bigint;
  threshold: bigint;
}): WithdrawAvailabilityBalanceState => {
  if (nativeBalance === 0n) {
    return 'zero';
  }

  if (nativeBalance < threshold) {
    return 'below-threshold';
  }

  return 'enough';
};

export const resolveWithdrawAvailability = ({
  selectedChainNamespace,
  assets,
  balances,
  disabledMessageByNamespace,
  hasNonInterfaceAssetBalance,
  nonInterfaceAssetMessage
}: {
  selectedChainNamespace: WithdrawAvailabilityNamespace;
  assets: Parameters<typeof getNativeAssetMetadata>[0];
  balances: ReadonlyArray<BalanceResult>;
  disabledMessageByNamespace: WithdrawDisabledMessageByNamespace;
  hasNonInterfaceAssetBalance: boolean;
  nonInterfaceAssetMessage: string;
}): WithdrawAvailability => {
  if (hasNonInterfaceAssetBalance) {
    return {
      kind: 'disabled',
      message: nonInterfaceAssetMessage
    };
  }

  const nativeAsset = ensurePresent(
    getNativeAssetMetadata(assets),
    'native asset metadata for withdraw availability'
  );
  const nativeBalance = ensurePresent(
    buildBalanceBySymbol(balances)[nativeAsset.symbol],
    `native asset balance for ${nativeAsset.symbol}`
  );
  const threshold =
    withdrawNativeBalanceThresholdByNamespace[selectedChainNamespace];
  const balanceState = resolveWithdrawAvailabilityBalanceState({
    nativeBalance,
    threshold
  });

  return match(balanceState, {
    zero: (): WithdrawAvailability => ({ kind: 'hidden' }),
    'below-threshold': (): WithdrawAvailability => ({
      kind: 'disabled',
      message: disabledMessageByNamespace[selectedChainNamespace]
    }),
    enough: (): WithdrawAvailability => ({ kind: 'enabled' })
  });
};

const isEvmTxRef = (txRef: string): boolean =>
  /^0x[0-9a-fA-F]{64}$/.test(txRef);

const isBitcoinTxRef = (txRef: string): boolean =>
  /^[0-9a-fA-F]{64}$/.test(txRef);

type TxExplorerMetadata = {
  name: string;
  url: string;
};

export const getTxExplorerMetadataFromRef = (
  txRef: string | null
): TxExplorerMetadata | null => {
  if (!txRef) {
    return null;
  }

  if (isEvmTxRef(txRef)) {
    return {
      name: 'Etherscan',
      url: `https://etherscan.io/tx/${txRef}`
    };
  }

  if (isBitcoinTxRef(txRef)) {
    return {
      name: 'mempool.space',
      url: `https://mempool.space/tx/${txRef}`
    };
  }

  return null;
};

export const getTxUrlFromRef = (txRef: string | null): string | null =>
  getTxExplorerMetadataFromRef(txRef)?.url ?? null;

const toActivityTimestampMs = (timestamp: number | null): number => {
  if (timestamp === null) {
    return 0;
  }

  return timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
};

const toActivityBlockNumber = (blockNumber: bigint | null): bigint =>
  blockNumber ?? 0n;

export const getLatestOutboundActivity = (
  activities: ReadonlyArray<ActivityRow>
): ActivityRow | undefined => {
  const outboundActivities = activities.filter(
    activity => activity.direction === 'outbound'
  );

  if (!outboundActivities.length) {
    return undefined;
  }

  return outboundActivities.reduce((latest, activity) => {
    const activityTimestampMs = toActivityTimestampMs(activity.timestamp);
    const latestTimestampMs = toActivityTimestampMs(latest.timestamp);

    if (activityTimestampMs > latestTimestampMs) {
      return activity;
    }

    if (activityTimestampMs < latestTimestampMs) {
      return latest;
    }

    const activityBlockNumber = toActivityBlockNumber(activity.blockNumber);
    const latestBlockNumber = toActivityBlockNumber(latest.blockNumber);

    if (activityBlockNumber > latestBlockNumber) {
      return activity;
    }

    return latest;
  });
};

export const resolveWithdrawnActivityFallbackMetadata = (
  activities: ReadonlyArray<ActivityRow>
): {
  destinationAddress: string | null;
  txRef: string | null;
} => {
  const latestOutboundActivity = getLatestOutboundActivity(activities);

  if (!latestOutboundActivity) {
    return {
      destinationAddress: null,
      txRef: null
    };
  }

  return {
    destinationAddress: latestOutboundActivity.counterparty,
    txRef: latestOutboundActivity.txRef
  };
};
