import type { EmptyVaultResult, PersistedAccount } from '@project-eleven/libqc';

export const failedWithdrawalErrorMessage =
  'Vault withdrawal failed after submission';

type WithdrawalResultIdentityFields = Pick<
  EmptyVaultResult,
  'accountId' | 'destinationChain'
>;

type SelectedAccountIdentityFields = Pick<PersistedAccount, 'id' | 'chainId'>;

export const assertWithdrawalResultIdentity = ({
  result,
  selectedAccount
}: {
  result: WithdrawalResultIdentityFields;
  selectedAccount: SelectedAccountIdentityFields;
}): void => {
  const expectedAccountId = selectedAccount.id.toString();
  const expectedChainId = selectedAccount.chainId.toString();

  if (result.accountId !== expectedAccountId) {
    throw new Error(
      `Withdrawal account mismatch: expected ${expectedAccountId}, got ${result.accountId}`
    );
  }

  if (result.destinationChain !== expectedChainId) {
    throw new Error(
      `Withdrawal chain mismatch: expected ${expectedChainId}, got ${result.destinationChain}`
    );
  }
};
