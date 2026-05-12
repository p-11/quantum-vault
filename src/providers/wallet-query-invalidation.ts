import type { QueryClient } from '@tanstack/react-query';
import type { WithdrawalRecord } from '@project-eleven/libqc';

import type { CurrencyCode } from '@/lib/currency';
import { vaultQueryKeys } from '@/modules/vaults/data/query-keys';

/**
 * Structural shape of the libqc `PersistedAccount` fields this module reads.
 * Kept narrow on purpose so unit tests can construct fixtures without standing
 * up real `caip` `AccountId`/`ChainId` class instances.
 */
type PersistedAccountShape = {
  id: { toString(): string };
  chainId: { namespace: string; toString(): string };
  address: string;
};

const evmChainNamespace = 'eip155';
const bitcoinChainNamespace = 'bip122';

const isBech32BitcoinAddress = (address: string): boolean => {
  const lowerAddress = address.toLowerCase();
  const isSingleCase =
    address === lowerAddress || address === address.toUpperCase();

  return (
    isSingleCase &&
    (lowerAddress.startsWith('bc1') ||
      lowerAddress.startsWith('tb1') ||
      lowerAddress.startsWith('bcrt1'))
  );
};

const normalizeAddressForChain = ({
  address,
  chainNamespace
}: {
  address: string;
  chainNamespace: string;
}): string =>
  chainNamespace === evmChainNamespace ||
  (chainNamespace === bitcoinChainNamespace && isBech32BitcoinAddress(address))
    ? address.toLowerCase()
    : address;

export const resolveOwnedDestinationAccountId = ({
  accounts,
  destinationAddress,
  sourceAccount
}: {
  accounts: ReadonlyArray<PersistedAccountShape>;
  destinationAddress: string;
  sourceAccount: PersistedAccountShape;
}): string | undefined => {
  const sourceAccountId = sourceAccount.id.toString();
  const sourceChainId = sourceAccount.chainId.toString();
  const normalizedDestinationAddress = normalizeAddressForChain({
    address: destinationAddress,
    chainNamespace: sourceAccount.chainId.namespace
  });

  return accounts
    .find(
      account =>
        account.id.toString() !== sourceAccountId &&
        account.chainId.toString() === sourceChainId &&
        normalizeAddressForChain({
          address: account.address,
          chainNamespace: account.chainId.namespace
        }) === normalizedDestinationAddress
    )
    ?.id.toString();
};

export const resolveOwnedWithdrawalDestinationAccountId = ({
  accounts,
  sourceAccount,
  withdrawalRecord
}: {
  accounts: ReadonlyArray<PersistedAccountShape>;
  sourceAccount: PersistedAccountShape;
  withdrawalRecord: Pick<WithdrawalRecord, 'destinationAddress'>;
}): string | undefined =>
  resolveOwnedDestinationAccountId({
    accounts,
    destinationAddress: withdrawalRecord.destinationAddress,
    sourceAccount
  });

const getUniquePresentIds = (
  accountIds: ReadonlyArray<string | undefined>
): Array<string> => [
  ...new Set(accountIds.filter((id): id is string => id !== undefined))
];

export const resolvePostWithdrawAccountIdsToInvalidate = ({
  sourceAccountId,
  replacementAccountId,
  ownedDestinationAccountId
}: {
  sourceAccountId: string;
  replacementAccountId: string | undefined;
  ownedDestinationAccountId: string | undefined;
}): Array<string> =>
  getUniquePresentIds([
    sourceAccountId,
    replacementAccountId,
    ownedDestinationAccountId
  ]);

export const invalidateVaultAccountQueriesForSession = ({
  queryClient,
  requestedCurrency,
  requestedSessionId,
  accountIds
}: {
  queryClient: Pick<QueryClient, 'invalidateQueries'>;
  requestedCurrency: CurrencyCode;
  requestedSessionId: number;
  accountIds: ReadonlyArray<string>;
}): Promise<Array<unknown>> =>
  Promise.all(
    accountIds.flatMap(accountId => [
      queryClient.invalidateQueries({
        queryKey: vaultQueryKeys.accountData({
          sessionId: requestedSessionId,
          accountId,
          currency: requestedCurrency
        })
      }),
      queryClient.invalidateQueries({
        queryKey: vaultQueryKeys.accountActivities({
          sessionId: requestedSessionId,
          accountId
        })
      }),
      queryClient.invalidateQueries({
        queryKey: vaultQueryKeys.vaultDetail({
          sessionId: requestedSessionId,
          accountId,
          currency: requestedCurrency
        })
      })
    ])
  );
