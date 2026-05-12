export const toastMessages = {
  unexpectedError: 'An unexpected error occurred, please try again',
  vaultQueryVaultStateFailed:
    'Vault access failed. Unlock your wallet and try again. If this keeps happening, restore from your recovery phrase.',
  vaultQueryConfigInvalid:
    'Wallet configuration is missing or invalid. Reload the extension and try again.',
  vaultQueryRateLimited:
    'Too many requests right now. Returning to home; reopen the vault in a moment.',
  vaultQueryRpcUnavailable:
    'Blockchain service is temporarily unavailable. Returning to home.',
  vaultQueryNetworkUnavailable:
    'Cannot reach the network. Check your internet connection, then reopen the vault from home.',
  invalidAddress: 'Invalid address. Please re-enter the address and try again.',
  insufficientFunds: 'Insufficient funds.',
  copiedToClipboard: 'Copied to clipboard.',
  invalidSecretPhrase:
    'Invalid secret phrase. Please ensure you entered all 24 words correctly.',
  transactionSent: 'Transaction sent.',
  invalidPassword: 'Invalid password.',
  passwordMismatch: 'Passwords do not match.',
  passwordUpdated: 'Your password has been updated.',
  invalidContractAddress: 'Please enter a valid contract address.',
  unsupportedAsset: 'Unsupported asset.',
  unsupportedContractType: 'Unsupported contract type.',
  balanceProviderUnavailable:
    'Unable to refresh balances. Retrying in the background.',
  balanceProviderRecovered: 'Balance connection restored.',
  balanceRefreshSuccess: 'Balances refreshed.',
  balanceRefreshFailed: 'Unable to refresh balances. Try again in a moment.',
  balanceRefreshInProgress: 'Balance refresh already in progress.',
  walletSyncSuccess: 'Wallet synced successfully.',
  walletSyncFailed: 'Failed to sync wallet.',
  walletCreationFailed: 'Wallet creation failed. Please try again.',
  withdrawalDetectedAsFailed: 'Withdrawal failed. Review activity and retry.',
  domainNameRegistered: 'Domain name registered.',
  domainNameRecordExists: 'Domain name record already exists.',
  invalidSecretPhraseConfirmation: "That doesn't look right. Please try again.",
  atlasDomainNameAlreadyRegistered: 'Domain name already registered.',
  atlasInvalidPayment: 'Invalid payment.',
  atlasInvalidPreClaim: 'Invalid pre-claim.',
  atlasPreClaimAlreadyExists: 'Pre-claim already exists.',
  atlasUnsupportedChain: 'Unsupported chain.',
  atlasInsufficientFunds: 'Insufficient funds.',
  atlasRecordNotFound: 'Domain name record not found.',
  atlasMismatchedChain: 'This domain cannot receive funds from this network.'
};
