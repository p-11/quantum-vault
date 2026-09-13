import type {
  AccountClientInterface,
  AddressIndex,
  ChainId,
  PersistedAccount
} from '@project-eleven/libqc';

import { ensurePresent } from '@/lib/assert';
import { attempt } from '@/lib/attempt';
import { defaultAccountChainIds } from '@/providers/default-accounts';
import { getNextAddressIndexForChain } from '@/providers/replacement-account';

// libqc declares `AccountStatus` in `account/client` but does not re-export
// it from the public entry point. Derive the union from the public
// `AccountClientInterface.getStatus` return type so this module stays
// boundary-clean (no deep imports) and tracks the SDK contract.
export type AccountStatus = Awaited<
  ReturnType<AccountClientInterface['getStatus']>
>;

const accountStatusRequiresRepair = {
  safe: false,
  vulnerable: true
} satisfies Record<AccountStatus, boolean>;

type AccountStatusRepairDecision = {
  requiresRepair: boolean;
};

type AccountIdentity = {
  id: { toString(): string };
  chainId: ChainId;
};

export type SafeVaultRepairAction =
  | { kind: 'skip' }
  | { kind: 'create'; addressIndex: AddressIndex | undefined };

type ResolveSafeVaultRepairActionInput = {
  chainAccountStatuses: ReadonlyArray<AccountStatus>;
  allAccounts: ReadonlyArray<Pick<PersistedAccount, 'chainId'>>;
  chainId: ChainId;
};

/**
 * Decides whether the boot-time safety net should mint a fresh safe vault on
 * `chainId`.
 *
 * The current account list (`chainAccountStatuses`) is examined via libqc's
 * `getStatus()` reporting. When at least one account on the chain reports
 * `'safe'`, the chain is healthy and no action is required. When every
 * account on the chain is `'vulnerable'`, the user has no safe deposit
 * destination on that chain and is exposed to fund loss until a fresh vault
 * exists - mint one at the next derivation index.
 *
 * This complements PR #276's post-withdraw rotation: if that rotation was
 * interrupted by a popup-close race (or if the vault was vulnerable already
 * before PR #276 shipped), the next time the popup boots this resolver will
 * provision the safe replacement deterministically.
 */
export const resolveSafeVaultRepairAction = ({
  chainAccountStatuses,
  allAccounts,
  chainId
}: ResolveSafeVaultRepairActionInput): SafeVaultRepairAction => {
  if (chainAccountStatuses.length === 0) {
    return { kind: 'skip' };
  }
  const repairDecisions: ReadonlyArray<AccountStatusRepairDecision> =
    chainAccountStatuses.map(status => ({
      requiresRepair: accountStatusRequiresRepair[status]
    }));

  if (repairDecisions.some(decision => !decision.requiresRepair)) {
    return { kind: 'skip' };
  }
  return {
    kind: 'create',
    addressIndex: getNextAddressIndexForChain({
      accounts: allAccounts,
      chainId
    })
  };
};

export type DefaultChainGroup<
  TAccount extends Pick<PersistedAccount, 'chainId'>
> = {
  chainId: ChainId;
  accountsOnChain: ReadonlyArray<TAccount>;
};

/**
 * Builds the per-default-chain groups the safety net must inspect.
 *
 * A default chain with zero persisted accounts is omitted: that case is the
 * "missing default chain" branch already covered by `repairDefaultAccounts`'s
 * existing logic. Only chains that already have at least one persisted
 * account need a safety-net pass.
 */
export const getDefaultChainGroupsToInspect = <
  TAccount extends Pick<PersistedAccount, 'chainId'>
>({
  accounts,
  supportedChains
}: {
  accounts: ReadonlyArray<TAccount>;
  supportedChains: ReadonlyArray<{ chainId: ChainId }>;
}): ReadonlyArray<DefaultChainGroup<TAccount>> => {
  const supportedChainById = new Map(
    supportedChains.map(chain => [chain.chainId.toString(), chain.chainId])
  );

  return defaultAccountChainIds.flatMap(defaultChainIdKey => {
    const chainId = ensurePresent(
      supportedChainById.get(defaultChainIdKey),
      `supported default account chain ${defaultChainIdKey}`
    );
    const accountsOnChain = accounts.filter(
      account => account.chainId.toString() === defaultChainIdKey
    );
    if (accountsOnChain.length === 0) {
      return [];
    }
    return [{ chainId, accountsOnChain }];
  });
};

export type SafeVaultRepairWarningKind =
  | 'status-inspection-failed'
  | 'account-creation-failed';

type RepairUnsafeDefaultAccountsInput = {
  vault: {
    listAccounts(): Promise<ReadonlyArray<AccountIdentity>>;
    getSupportedChains(): ReadonlyArray<{ chainId: ChainId }>;
    getAccount(
      accountId: AccountIdentity['id']
    ): Promise<Pick<AccountClientInterface, 'getStatus'>>;
    createAccount(
      chainId: ChainId,
      forceNewAddress?: boolean,
      version?: unknown,
      addressIndex?: AddressIndex
    ): Promise<unknown>;
  };
  onRepairWarning?: ({
    chainId,
    error,
    kind
  }: {
    chainId: ChainId;
    error: unknown;
    kind: SafeVaultRepairWarningKind;
  }) => void;
};

/**
 * Upper bound on consecutive safe-vault repairs per default chain within a
 * single pass. libqc's `importWallet` persists no accounts, so a recovered
 * wallet only gets its index-0 vault back from the missing-chain branch;
 * every later vault (each `emptyVault` rotation mints the next index) has
 * to be re-derived here. Chaining repairs until the freshly minted vault
 * reports `safe` rediscovers them in one hydration instead of one index per
 * popup boot. The cap keeps a pathological status provider from spinning.
 */
export const maxSafeVaultRepairsPerChain = 20;

const getAccountIds = (
  accounts: ReadonlyArray<AccountIdentity>
): ReadonlySet<string> =>
  new Set(accounts.map(account => account.id.toString()));

export const repairUnsafeDefaultAccounts = async ({
  vault,
  onRepairWarning
}: RepairUnsafeDefaultAccountsInput): Promise<number> => {
  const accountsAfterMissingRepair = await vault.listAccounts();
  const safetyNetGroups = getDefaultChainGroupsToInspect({
    accounts: accountsAfterMissingRepair,
    supportedChains: vault.getSupportedChains()
  });
  let createdCount = 0;

  const inspectStatuses = (accounts: ReadonlyArray<AccountIdentity>) =>
    attempt(() =>
      Promise.all(
        accounts.map(async account => {
          const accountClient = await vault.getAccount(account.id);
          return accountClient.getStatus();
        })
      )
    );

  for (const group of safetyNetGroups) {
    let latestAccounts = await vault.listAccounts();
    const chainAccountStatusesResult = await inspectStatuses(
      group.accountsOnChain
    );
    if ('error' in chainAccountStatusesResult) {
      onRepairWarning?.({
        chainId: group.chainId,
        error: chainAccountStatusesResult.error,
        kind: 'status-inspection-failed'
      });
      continue;
    }

    let chainAccountStatuses: ReadonlyArray<AccountStatus> =
      chainAccountStatusesResult.data;
    for (
      let repairAttempt = 0;
      repairAttempt < maxSafeVaultRepairsPerChain;
      repairAttempt += 1
    ) {
      const repairAction = resolveSafeVaultRepairAction({
        chainAccountStatuses,
        allAccounts: latestAccounts,
        chainId: group.chainId
      });
      if (repairAction.kind === 'skip') {
        break;
      }

      const createResult = await attempt(() =>
        vault.createAccount(
          group.chainId,
          undefined,
          undefined,
          repairAction.addressIndex
        )
      );
      if ('error' in createResult) {
        onRepairWarning?.({
          chainId: group.chainId,
          error: createResult.error,
          kind: 'account-creation-failed'
        });
        break;
      }

      createdCount += 1;

      // Inspect what was just minted. A brand-new derivation is `safe` and
      // ends the chain; a recovered index that was already rotated on-chain
      // is `vulnerable` and the loop advances to the next index.
      const knownAccountIds = getAccountIds(latestAccounts);
      latestAccounts = await vault.listAccounts();
      const mintedAccounts = latestAccounts.filter(
        account =>
          account.chainId.toString() === group.chainId.toString() &&
          !knownAccountIds.has(account.id.toString())
      );
      if (mintedAccounts.length === 0) {
        break;
      }

      const mintedStatusesResult = await inspectStatuses(mintedAccounts);
      if ('error' in mintedStatusesResult) {
        onRepairWarning?.({
          chainId: group.chainId,
          error: mintedStatusesResult.error,
          kind: 'status-inspection-failed'
        });
        break;
      }

      chainAccountStatuses = [
        ...chainAccountStatuses,
        ...mintedStatusesResult.data
      ];
    }
  }

  return createdCount;
};
