import {
  type AccountClientInterface,
  isBitcoinChain,
  type AddressIndex,
  type ChainId
} from '@project-eleven/libqc';

export type ReplacementAccountStatus = NonNullable<
  Awaited<ReturnType<AccountClientInterface['getStatus']>>
>;

type AccountWithChain = {
  chainId: ChainId;
};

type AccountWithReplacementStatus = AccountWithChain & {
  id: { toString(): string };
  status: ReplacementAccountStatus | 'unknown';
};

const replacementAccountStatusIsSafe = {
  safe: true,
  vulnerable: false
} satisfies Record<ReplacementAccountStatus, boolean>;

export type ReplacementVaultAction =
  | { kind: 'skip' }
  | { kind: 'create'; addressIndex: AddressIndex | undefined };

type ResolveReplacementVaultActionInput = {
  accounts: ReadonlyArray<AccountWithReplacementStatus>;
  sourceChainId: ChainId;
  sourceAccountId: string;
  ownedDestinationAccountId: string | undefined;
};

type GetNextAddressIndexForChainInput = {
  accounts: ReadonlyArray<AccountWithChain>;
  chainId: ChainId;
};

// `AddressIndex` is a `Brand<number, 'AddressIndex'>` exported from libqc and
// libqc does not expose a public constructor. Encapsulate the brand boundary
// in a single helper so the rest of the codebase trusts the branded type.
const toAddressIndex = (value: number): AddressIndex => value as AddressIndex;

/**
 * Computes the address index to pass to libqc's `createAccount(chainId, _, _,
 * indexOverride)` when minting a fresh vault on `chainId`.
 *
 * libqc's default `createAccount(chainId)` is idempotent for Bitcoin: without
 * an `indexOverride` it returns the existing single-per-chain account, which
 * is the just-drained (now vulnerable) source after an `emptyVault(...)`. The
 * next free index forces a fresh BIP-85 derivation.
 *
 * EVM's default index derivation already advances past addresses that have an
 * account on the chain, so EVM callers pass `undefined` and let libqc decide.
 *
 * Shared between PR #276's post-withdraw rotation and the boot-time safe-vault
 * safety net so both paths agree on the next index for a given chain.
 */
export const getNextAddressIndexForChain = ({
  accounts,
  chainId
}: GetNextAddressIndexForChainInput): AddressIndex | undefined => {
  if (!isBitcoinChain(chainId)) return undefined;
  const chainKey = chainId.toString();
  const sameChainCount = accounts.filter(
    account => account.chainId.toString() === chainKey
  ).length;
  return toAddressIndex(sameChainCount);
};

/**
 * Decides whether the post-withdraw hook should mint a replacement vault.
 *
 * When the destination is a vault the user already owns on the same chain
 * (`ownedDestinationAccountId !== undefined`), they already have a safe
 * deposit destination. Minting another vault produces the redundant safe
 * vault Tyler reported (e.g. ending up with `BTC Vault #03` holding the
 * migrated funds plus an empty `BTC Vault #04`).
 *
 * When the destination is external (`ownedDestinationAccountId === undefined`)
 * but another same-chain account already reports `safe`, the user still has a
 * safe deposit destination and retries can reuse it instead of minting
 * `#02`, `#03`, `#04` across transient `emptyVault` failures.
 *
 * Otherwise, mint one. For Bitcoin the next free address index is passed
 * explicitly (see `getReplacementAddressIndex`); for EVM libqc's default index
 * derivation is sufficient.
 */
export const resolveReplacementVaultAction = ({
  accounts,
  sourceChainId,
  sourceAccountId,
  ownedDestinationAccountId
}: ResolveReplacementVaultActionInput): ReplacementVaultAction => {
  if (ownedDestinationAccountId !== undefined) return { kind: 'skip' };
  const sourceChainKey = sourceChainId.toString();
  const sameChainReplacementCandidates = accounts.filter(
    account =>
      account.id.toString() !== sourceAccountId &&
      account.chainId.toString() === sourceChainKey
  );
  const hasSafeReplacementAccount = sameChainReplacementCandidates.some(
    account =>
      account.status !== 'unknown' &&
      replacementAccountStatusIsSafe[account.status]
  );
  if (hasSafeReplacementAccount) return { kind: 'skip' };

  const hasUnknownReplacementCandidate = sameChainReplacementCandidates.some(
    account => account.status === 'unknown'
  );
  if (hasUnknownReplacementCandidate) return { kind: 'skip' };

  return {
    kind: 'create',
    addressIndex: getNextAddressIndexForChain({
      accounts,
      chainId: sourceChainId
    })
  };
};
