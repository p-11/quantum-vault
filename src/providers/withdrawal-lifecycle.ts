import { attempt } from '@/lib/attempt';
import { match } from '@/lib/match';
import {
  getLatestWithdrawalRecord,
  isSnapshotPostWithdraw
} from '@/modules/vaults/lifecycle/adapter';
import type { VaultSnapshot } from '@/modules/vaults/types';
import type {
  LibQC,
  PersistedAccount,
  WithdrawalRecord
} from '@project-eleven/libqc';

type AccountWithId = Pick<PersistedAccount, 'id'>;

type WithdrawalLifecycleReader = Pick<LibQC, 'listWithdrawals'>;

export type LatestWithdrawalRecordByAccountId = Partial<
  Record<string, WithdrawalRecord>
>;

const extractWarnableError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const isInFlightWithdrawalRecordStatus: Record<
  WithdrawalRecord['status'],
  boolean
> = {
  pending: true,
  sent: true,
  withdrawn: false,
  failed: false
};

export const buildLatestWithdrawalRecordByAccountId = ({
  accountId,
  records,
  previous
}: {
  accountId: string;
  records: ReadonlyArray<WithdrawalRecord>;
  previous: LatestWithdrawalRecordByAccountId;
}): LatestWithdrawalRecordByAccountId => {
  const latestRecord = getLatestWithdrawalRecord(records);
  const previousRecord = previous[accountId];
  if (latestRecord === undefined) {
    if (
      previousRecord !== undefined &&
      isInFlightWithdrawalRecordStatus[previousRecord.status]
    ) {
      return previous;
    }
    const next = { ...previous };
    delete next[accountId];
    return next;
  }
  // Guard against the SDK's just-submitted-withdrawal indexing window: if
  // an in-flight optimistic record is locally newer than anything the SDK
  // returned, keep it. The reconcile loop will re-apply the SDK record
  // once `initiatedAt` catches up.
  if (
    previousRecord !== undefined &&
    previousRecord.initiatedAt > latestRecord.initiatedAt
  ) {
    return previous;
  }
  if (previousRecord?.id === latestRecord.id) {
    return previous;
  }
  return {
    ...previous,
    [accountId]: latestRecord
  };
};

export const mergeLatestWithdrawalRecordByAccountId = ({
  previous,
  loaded
}: {
  previous: LatestWithdrawalRecordByAccountId;
  loaded: LatestWithdrawalRecordByAccountId;
}): LatestWithdrawalRecordByAccountId => {
  const next: LatestWithdrawalRecordByAccountId = { ...loaded };

  for (const [accountId, previousRecord] of Object.entries(previous)) {
    if (previousRecord === undefined) {
      continue;
    }

    const loadedRecord = loaded[accountId];
    if (loadedRecord === undefined) {
      if (isInFlightWithdrawalRecordStatus[previousRecord.status]) {
        next[accountId] = previousRecord;
      }
      continue;
    }

    if (previousRecord.initiatedAt > loadedRecord.initiatedAt) {
      next[accountId] = previousRecord;
    }
  }

  return next;
};

export const selectWithdrawalRecordToReconcile = ({
  latestWithdrawalRecordByAccountId,
  accounts,
  inFlightWithdrawalRecordIds,
  settledWithdrawalRecordIds
}: {
  latestWithdrawalRecordByAccountId: LatestWithdrawalRecordByAccountId;
  accounts: ReadonlyArray<Pick<PersistedAccount, 'id'>>;
  inFlightWithdrawalRecordIds: ReadonlySet<string>;
  settledWithdrawalRecordIds: ReadonlySet<string>;
}): { accountId: string; record: WithdrawalRecord } | undefined =>
  Object.entries(latestWithdrawalRecordByAccountId).reduce<
    { accountId: string; record: WithdrawalRecord } | undefined
  >((best, [accountId, record]) => {
    if (
      record === undefined ||
      !isInFlightWithdrawalRecordStatus[record.status]
    ) {
      return best;
    }
    if (inFlightWithdrawalRecordIds.has(record.id)) {
      return best;
    }
    if (settledWithdrawalRecordIds.has(record.id)) {
      return best;
    }
    const accountStillExists = accounts.some(
      account => account.id.toString() === accountId
    );
    if (!accountStillExists) {
      return best;
    }
    if (!best) {
      return { accountId, record };
    }
    if (record.initiatedAt > best.record.initiatedAt) {
      return { accountId, record };
    }
    if (record.initiatedAt < best.record.initiatedAt) {
      return best;
    }
    return record.id > best.record.id ? { accountId, record } : best;
  }, undefined);

export const loadLatestWithdrawalRecordByAccountId = async ({
  accounts,
  vault
}: {
  accounts: ReadonlyArray<AccountWithId>;
  vault: WithdrawalLifecycleReader;
}): Promise<LatestWithdrawalRecordByAccountId> => {
  const results = await Promise.all(
    accounts.map(async account => {
      const recordsResult = await attempt(() =>
        vault.listWithdrawals(account.id)
      );
      const accountId = account.id.toString();
      if ('error' in recordsResult) {
        console.warn(
          `Failed to load withdrawal lifecycle for account ${accountId}:`,
          extractWarnableError(recordsResult.error)
        );
        return { accountId, records: null };
      }
      return { accountId, records: recordsResult.data };
    })
  );

  return results.reduce<LatestWithdrawalRecordByAccountId>((acc, result) => {
    if (result.records === null) {
      return acc;
    }
    return buildLatestWithdrawalRecordByAccountId({
      accountId: result.accountId,
      records: result.records,
      previous: acc
    });
  }, {});
};

export const resolvePostWithdrawSourceState = ({
  sourceAccountId,
  summaryAccounts,
  sourceLatestWithdrawalRecord,
  sourceSnapshot
}: {
  sourceAccountId: string;
  summaryAccounts: ReadonlyArray<AccountWithId>;
  sourceLatestWithdrawalRecord: WithdrawalRecord | undefined;
  sourceSnapshot: VaultSnapshot | undefined;
}): boolean => {
  const sourceStillVisible = summaryAccounts.some(
    account => account.id.toString() === sourceAccountId
  );
  if (!sourceStillVisible) {
    return true;
  }

  if (sourceLatestWithdrawalRecord !== undefined) {
    return resolveByLatestRecordStatus({
      sourceLatestWithdrawalRecord,
      sourceSnapshot
    });
  }

  if (sourceSnapshot !== undefined && isSnapshotPostWithdraw(sourceSnapshot)) {
    return true;
  }

  return false;
};

/**
 * Decides whether the post-withdraw reconcile loop has reached a terminal
 * "idle" state.
 *
 * The source must reflect the post-withdraw state in all cases. The
 * destination-side signal is only required when the withdraw path actually
 * minted a replacement vault (`expectsReplacementAccount`): it is satisfied
 * either by that newly minted account or by the user-owned destination
 * account that already existed before the withdraw.
 *
 * When no replacement was minted - the destination is an owned vault, or
 * another same-chain vault was already `safe` / had an unknown status
 * (`resolveReplacementVaultAction`'s skip branches), or the reconcile was
 * auto-resumed on a later boot after the replacement already existed - no
 * fresh account will ever appear outside the baseline. Waiting for one
 * would poll until the 30s timeout and surface a false "timeout" status,
 * so the source-side signal alone is terminal in that case.
 */
export const isPostWithdrawComplete = ({
  expectsReplacementAccount,
  ownedDestinationAccountId,
  replacementAccount,
  sourceReflectsPostWithdraw
}: {
  expectsReplacementAccount: boolean;
  ownedDestinationAccountId: string | undefined;
  replacementAccount: AccountWithId | undefined;
  sourceReflectsPostWithdraw: boolean;
}): boolean => {
  if (!sourceReflectsPostWithdraw) return false;
  if (!expectsReplacementAccount) return true;
  return (
    ownedDestinationAccountId !== undefined || replacementAccount !== undefined
  );
};

const resolveByLatestRecordStatus = ({
  sourceLatestWithdrawalRecord,
  sourceSnapshot
}: {
  sourceLatestWithdrawalRecord: WithdrawalRecord;
  sourceSnapshot: VaultSnapshot | undefined;
}): boolean => {
  const isSnapshotEmpty =
    sourceSnapshot !== undefined && isSnapshotPostWithdraw(sourceSnapshot);
  return match(sourceLatestWithdrawalRecord.status, {
    withdrawn: () => true,
    failed: () => false,
    pending: () => isSnapshotEmpty,
    sent: () => isSnapshotEmpty
  });
};
