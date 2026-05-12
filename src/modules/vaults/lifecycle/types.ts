import type { WithdrawalRecord } from '@project-eleven/libqc';

import { type VaultLifecycleKind } from './core';

/**
 * Discriminated union: the full vault lifecycle state the UI reads.
 *
 * Withdrawal lifecycle types (`WithdrawalRecord`, `WithdrawalTxIdentifier`,
 * `WithdrawalLifecycleStatus`) are owned by `@project-eleven/libqc` and
 * imported directly at every consumer — there is no facade re-export here.
 *
 * `VaultLifecycleStatus` extends the SDK's lifecycle states with the
 * chrome-only `safe` / `vulnerable` kinds derived from snapshot status when
 * no withdrawal record exists. Withdrawal record-backed variants carry
 * destination + txRefs; recovered recordless withdrawn vaults intentionally
 * keep that metadata null/empty instead of fabricating it.
 */
export type VaultLifecycleStatus =
  | { kind: Extract<VaultLifecycleKind, 'safe'> }
  | {
      kind: Extract<VaultLifecycleKind, 'vulnerable'>;
      exposureReason: 'pubkey-exposed';
    }
  | {
      kind: Extract<VaultLifecycleKind, 'pending'>;
      initiatedAt: number;
      destinationAddress: WithdrawalRecord['destinationAddress'];
      txRefs: ReadonlyArray<string>;
    }
  | {
      kind: Extract<VaultLifecycleKind, 'sent'>;
      confirmedAt: number;
      destinationAddress: WithdrawalRecord['destinationAddress'];
      txRefs: ReadonlyArray<string>;
    }
  | {
      kind: Extract<VaultLifecycleKind, 'withdrawn'>;
      completedAt: number | null;
      destinationAddress: WithdrawalRecord['destinationAddress'] | null;
      txRefs: ReadonlyArray<string>;
    };
