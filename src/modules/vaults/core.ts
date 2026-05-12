/**
 * Core vault status taxonomy used across Home + Vault Detail surfaces.
 *
 * `vaultStatuses` is the single source of truth for the visual grouping shown
 * on the Home screen (Figma 31:7140 sections: VULNERABLE / SAFE / WITHDRAWN).
 * The derived `VaultStatus` union powers `Record`-based style lookups and
 * exhaustive pattern matching throughout the module.
 */

export const vaultStatuses = ['vulnerable', 'safe', 'withdrawn'] as const;

export type VaultStatus = (typeof vaultStatuses)[number];

export const vaultStatusLabels: Record<VaultStatus, string> = {
  vulnerable: 'VULNERABLE',
  safe: 'SAFE',
  withdrawn: 'WITHDRAWN'
};

/**
 * Ordering convention for the Home screen unified scroll view.
 * `vulnerable` first, then `safe`, then `withdrawn`.
 */
export const homeSectionOrder: ReadonlyArray<VaultStatus> = vaultStatuses;
