import { ensurePresent } from '@/lib/assert';
import { match, matchDiscriminatedUnion } from '@/lib/match';
import type {
  WithdrawalRecord,
  WithdrawalTxIdentifier
} from '@project-eleven/libqc';
import type { VaultStatus } from '../core';
import type { VaultSnapshot } from '../types';
import type { VaultLifecycleStatus } from './types';

const getTxRef = (txRef: WithdrawalTxIdentifier): string =>
  matchDiscriminatedUnion(txRef, 'chain', 'data', {
    evm: data => data.txHash,
    bitcoin: data => data.txid
  });

export const getWithdrawalTxRefs = (
  record: WithdrawalRecord
): ReadonlyArray<string> => record.txRefs.map(getTxRef);

export const getLatestWithdrawalRecord = (
  records: ReadonlyArray<WithdrawalRecord>
): WithdrawalRecord | undefined =>
  records.reduce<WithdrawalRecord | undefined>((latest, current) => {
    if (!latest) {
      return current;
    }

    if (current.initiatedAt > latest.initiatedAt) {
      return current;
    }

    if (current.initiatedAt < latest.initiatedAt) {
      return latest;
    }

    return current.id > latest.id ? current : latest;
  }, undefined);

/**
 * Single source of truth for "is this snapshot already in a post-withdraw
 * shape?" — used both by the lifecycle adapter (when collapsing a `pending`
 * SDK record into the `sent` UI kind once the source is empty) and by the
 * reconcile loop (when deciding the source vault no longer has work).
 */
export const isSnapshotPostWithdraw = (snapshot: VaultSnapshot): boolean =>
  snapshot.tokenCount === 0 || snapshot.status === 'withdrawn';

const isRecordlessWithdrawnSnapshot = (snapshot: VaultSnapshot): boolean =>
  !snapshot.isUnavailable &&
  (snapshot.status === 'withdrawn' ||
    (snapshot.status === 'vulnerable' &&
      snapshot.tokenCount === 0 &&
      snapshot.totalBalance === 0));

const buildPendingLifecycleStatus = (
  record: WithdrawalRecord
): Extract<VaultLifecycleStatus, { kind: 'pending' }> => ({
  kind: 'pending',
  initiatedAt: record.initiatedAt,
  destinationAddress: record.destinationAddress,
  txRefs: getWithdrawalTxRefs(record)
});

const buildSentLifecycleStatus = ({
  record,
  confirmedAt
}: {
  record: WithdrawalRecord;
  confirmedAt: number;
}): Extract<VaultLifecycleStatus, { kind: 'sent' }> => ({
  kind: 'sent',
  confirmedAt,
  destinationAddress: record.destinationAddress,
  txRefs: getWithdrawalTxRefs(record)
});

const buildWithdrawnLifecycleStatus = (
  record: WithdrawalRecord
): Extract<VaultLifecycleStatus, { kind: 'withdrawn' }> => ({
  kind: 'withdrawn',
  completedAt: ensurePresent(
    record.completedAt,
    `completedAt for withdrawn withdrawal record ${record.id}`
  ),
  destinationAddress: record.destinationAddress,
  txRefs: getWithdrawalTxRefs(record)
});

const buildRecordlessWithdrawnLifecycleStatus = (): Extract<
  VaultLifecycleStatus,
  { kind: 'withdrawn' }
> => ({
  kind: 'withdrawn',
  completedAt: null,
  destinationAddress: null,
  txRefs: []
});

const resolveLifecycleWithoutWithdrawalRecord = ({
  snapshot
}: {
  snapshot: VaultSnapshot;
}): VaultLifecycleStatus => {
  if (isRecordlessWithdrawnSnapshot(snapshot)) {
    return buildRecordlessWithdrawnLifecycleStatus();
  }

  const snapshotStatus = snapshot.status;
  if (snapshotStatus === null) {
    return { kind: 'safe' };
  }

  return match<VaultStatus, VaultLifecycleStatus>(snapshotStatus, {
    safe: () => ({ kind: 'safe' }),
    vulnerable: () => ({
      kind: 'vulnerable',
      exposureReason: 'pubkey-exposed'
    }),
    withdrawn: buildRecordlessWithdrawnLifecycleStatus
  });
};

/**
 * Map SDK withdrawal lifecycle metadata + snapshot into the lifecycle union
 * consumed by Home and Vault Detail.
 */
export const deriveVaultLifecycleStatus = ({
  snapshot,
  withdrawalRecord
}: {
  snapshot: VaultSnapshot;
  withdrawalRecord: WithdrawalRecord | undefined;
}): VaultLifecycleStatus => {
  if (!withdrawalRecord) {
    return resolveLifecycleWithoutWithdrawalRecord({
      snapshot
    });
  }

  return match(withdrawalRecord.status, {
    pending: () =>
      isSnapshotPostWithdraw(snapshot)
        ? buildSentLifecycleStatus({
            record: withdrawalRecord,
            // SDK still reports pending but the source vault is already empty,
            // so confirmedAt cannot come from `sentAt` yet — use initiatedAt
            // as a stable approximation until the next reconcile transitions
            // the SDK record to `sent` and provides the real timestamp.
            confirmedAt: withdrawalRecord.initiatedAt
          })
        : buildPendingLifecycleStatus(withdrawalRecord),
    sent: () =>
      buildSentLifecycleStatus({
        record: withdrawalRecord,
        confirmedAt: ensurePresent(
          withdrawalRecord.sentAt,
          `sentAt for withdrawal record ${withdrawalRecord.id} in sent state`
        )
      }),
    withdrawn: () =>
      isSnapshotPostWithdraw(snapshot)
        ? buildWithdrawnLifecycleStatus(withdrawalRecord)
        : resolveLifecycleWithoutWithdrawalRecord({
            snapshot
          }),
    failed: () =>
      resolveLifecycleWithoutWithdrawalRecord({
        snapshot
      })
  });
};
