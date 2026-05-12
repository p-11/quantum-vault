import type {
  Activity,
  Asset,
  BalanceResult,
  PersistedAccount
} from '@project-eleven/libqc';
import type { UseQueryResult } from '@tanstack/react-query';

import type { CurrencyCode } from '@/lib/currency';
import type { VaultStatus } from '@/modules/vaults/core';
import type { VaultLifecycleKind } from '@/modules/vaults/lifecycle/core';
import type { VaultLifecycleStatus } from '@/modules/vaults/lifecycle/types';
import type { ActivityRow } from '../data/mappers/activity';
import type { SupportedChainShape } from '../data/mappers/vault';

export type VaultTabId = 'funds' | 'activity';

export type VaultData = {
  assets: Array<Asset>;
  balances: Array<BalanceResult>;
  activities: Array<ActivityRow>;
  hasNonInterfaceAssetBalance: boolean;
  onChainVaultStatus: VaultStatus;
  totalCurrencyValue: number;
};

export type VaultDetailQueryData = {
  assets: Array<Asset>;
  balances: Array<BalanceResult>;
  hasNonInterfaceAssetBalance: boolean;
  vaultState: VaultStatus;
  totalCurrencyValue: number;
};

export type VaultTitleInput = {
  selectedAccount: PersistedAccount;
  accounts: ReadonlyArray<PersistedAccount>;
  supportedChains: ReadonlyArray<SupportedChainShape>;
};

export type ActivityDateLabelInput = {
  timestamp: number | null;
  blockNumber: bigint | null;
};

export type ActivityAmountInput = {
  amount: bigint;
  decimals: number;
};

export type VaultDetailAccountClient = {
  listAssets(): Promise<Array<Asset>>;
  getBalances(assets: Array<Asset>): Promise<Array<BalanceResult>>;
  getActivities(): Promise<Array<Activity>>;
  getStatus(): Promise<VaultStatus>;
};

export type VaultDetailVault = {
  getAccount(id: PersistedAccount['id']): Promise<VaultDetailAccountClient>;
  getSupportedChains(): ReadonlyArray<SupportedChainShape>;
};

export type UseVaultDetailDataInput = {
  selectedAccount: PersistedAccount | undefined;
  vault: VaultDetailVault;
  currency: CurrencyCode;
  activeTabId: VaultTabId;
  sessionId: number;
  onUnexpectedError(error: unknown): void;
};

export type UseVaultDetailDataResult = {
  vaultData: VaultData | undefined;
  vaultDetailQuery: UseQueryResult<VaultDetailQueryData>;
  isActivityLoading: boolean;
  vaultState: VaultStatus;
  lifecycleKind: VaultLifecycleKind;
  lifecycleStatus: VaultLifecycleStatus;
};
