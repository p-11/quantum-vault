import type { WithdrawalRecord } from '@project-eleven/libqc';
import type { VaultSnapshot } from '../types';
import type { VaultLifecycleStatus } from './types';
import { deriveVaultLifecycleStatus } from './adapter';

/**
 * Read the vault lifecycle status for a single account.
 */
export const getVaultLifecycleStatus = ({
  snapshot,
  withdrawalRecord
}: {
  snapshot: VaultSnapshot;
  withdrawalRecord: WithdrawalRecord | undefined;
}): VaultLifecycleStatus =>
  deriveVaultLifecycleStatus({
    snapshot,
    withdrawalRecord
  });
