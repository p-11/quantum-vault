/**
 * Vault lifecycle kinds used by Vault Detail surfaces (Figma 32:1597 series).
 *
 * This extends the simple `VaultStatus` with the transient on-chain states
 * `pending` (withdrawal broadcast, awaiting confirmation) and `sent`
 * (withdrawal confirmed, funds moved).
 *
 * libqc's lifecycle metadata is SDK-owned. UI surfaces map the latest
 * `WithdrawalRecord` + snapshot into these lifecycle kinds.
 */

import { isOneOf } from '@/lib/assert';

export const vaultLifecycleKinds = [
  'safe',
  'vulnerable',
  'pending',
  'sent',
  'withdrawn'
] as const;

export type VaultLifecycleKind = (typeof vaultLifecycleKinds)[number];

export const vaultLifecycleLabels: Record<VaultLifecycleKind, string> = {
  safe: 'Safe',
  vulnerable: 'Vulnerable',
  pending: 'Transaction pending',
  sent: 'Withdrawal sent',
  withdrawn: 'Withdrawn'
};

/**
 * Lifecycle kinds where the user has already initiated a withdrawal.
 * `pending` keeps real on-chain funds (tx not yet mined); `sent` and
 * `withdrawn` represent funds that have left the source vault. UI
 * surfaces treat all three as "withdrawn" for visual grouping and
 * suppress the per-vault balance/token count to avoid showing a stale
 * pre-withdrawal value alongside a "Withdrawn" header.
 */
export const withdrawalLifecycleKinds = [
  'pending',
  'sent',
  'withdrawn'
] as const satisfies ReadonlyArray<VaultLifecycleKind>;

export type WithdrawalLifecycleKind = (typeof withdrawalLifecycleKinds)[number];

export const isWithdrawalLifecycleKind = (
  lifecycleKind: VaultLifecycleKind
): lifecycleKind is WithdrawalLifecycleKind =>
  isOneOf(lifecycleKind, withdrawalLifecycleKinds);
