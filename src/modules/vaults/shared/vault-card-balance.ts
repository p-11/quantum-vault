import { ensurePresent } from '@/lib/assert';
import {
  isWithdrawalLifecycleKind,
  type VaultLifecycleKind
} from '../lifecycle/core';
import type { VaultSnapshot } from '../types';

export type VaultCardBalanceDisplay =
  | { kind: 'unavailable' }
  | { kind: 'value'; totalBalance: number; tokenCount: number };

/**
 * Once a withdrawal has been initiated (pending / sent / withdrawn), the
 * vault appears under the "Withdrawn" home section. The on-chain snapshot
 * still reports the live balance during `pending`, which would surface a
 * pre-withdrawal dollar amount underneath a "Withdrawn" header. Collapse
 * the displayed totals to zero so the card matches its section header; if
 * the tx fails the lifecycle reverts to safe/vulnerable and the live
 * balance reappears.
 */
export const getVaultCardBalanceDisplay = ({
  snapshot,
  lifecycleKind
}: {
  snapshot: VaultSnapshot;
  lifecycleKind: VaultLifecycleKind;
}): VaultCardBalanceDisplay => {
  if (snapshot.isUnavailable) {
    return { kind: 'unavailable' };
  }

  if (isWithdrawalLifecycleKind(lifecycleKind)) {
    return { kind: 'value', totalBalance: 0, tokenCount: 0 };
  }

  return {
    kind: 'value',
    totalBalance: ensurePresent(
      snapshot.totalBalance,
      'vault snapshot total balance'
    ),
    tokenCount: ensurePresent(snapshot.tokenCount, 'vault snapshot token count')
  };
};
