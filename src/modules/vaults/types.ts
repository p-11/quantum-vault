import type { VaultStatus } from './core';

/**
 * Shape the Home + Vault Detail screens need per vault.
 * Computed locally from libqc; `status` may be null while the snapshot is
 * still loading and `isUnavailable` is true when the fetch failed. A
 * renderer must handle all three cases.
 */
export type VaultSnapshot = {
  status: VaultStatus | null;
  tokenCount: number | null;
  totalBalance: number | null;
  isUnavailable: boolean;
};

/**
 * Chain display metadata looked up from `vault.getSupportedChains()`.
 * Keyed by `chainId.reference` in consumer code.
 */
export type AccountChainMetadata = {
  iconUrl: string;
  name: string;
  symbol: string;
};

/**
 * Alert tone shared between danger (red) and warning (amber) banner variants.
 * Matches the two rendered states of the Figma `Alert` component (38:4737).
 */
export type AlertTone = 'danger' | 'warning';
