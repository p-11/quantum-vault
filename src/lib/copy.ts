/**
 * Centralized UI copy strings for Home + Vault Detail + Withdraw + Deposit
 * surfaces. `toastMessages` stays in `./content.ts` as the established
 * central bundle for toast-only text; this file carries screen chrome copy
 * so renderers never inline user-visible strings.
 *
 * Groups mirror the Figma frame taxonomy under section 31:1152.
 */

import type { WithdrawDisabledMessageByNamespace } from '@/modules/vaults/detail/core';

export const homeCopy = {
  title: 'Quantum Vault',
  totalBalanceLabel: 'TOTAL BALANCE',
  depositAction: 'Deposit',
  withdrawAction: 'Withdraw',
  refreshBalancesAria: 'Refresh balances',
  settingsAria: 'Settings',
  alertSingular: '1 Vault Vulnerable',
  alertPlural: (count: number) => `${count} Vaults Vulnerable`,
  atRiskSuffix: 'at risk',
  syncStateSyncingTitle: 'Withdrawal syncing',
  syncStateSyncingBody:
    'Withdrawal sent. Balances and vault sections are updating.',
  syncStateTimeoutTitle: 'Sync delayed',
  syncStateTimeoutBody:
    'Withdrawal was sent, but data refresh is taking longer than expected.',
  syncStateFailedTitle: 'Withdrawal failed',
  syncStateFailedBody:
    'Withdrawal failed after submission. Review activity and retry if needed.',
  syncStateDismissAria: 'Dismiss withdrawal sync notice',
  vaultSnapshotsError: 'Unable to load vault balances.'
};

export const vaultCardCopy = {
  tokenSingular: '1 Token',
  tokenPlural: (count: number) => `${count} Tokens`,
  unavailable: '--'
};

export const vaultDetailCopy = {
  safeBadge: 'SAFE',
  vulnerableBadge: 'VULNERABLE',
  withdrawnBadge: 'WITHDRAWN',
  totalBalanceLabel: 'TOTAL BALANCE',
  tabFunds: 'Funds',
  tabActivity: 'Activity',
  withdrawAction: 'Withdraw',
  withdrawToSafeAction: 'Withdraw',
  depositAction: 'Deposit',
  activityEmpty: 'No activity',
  activityDirectionReceived: 'Received',
  activityDirectionSent: 'Sent',
  activityDirectionWithdrawAll: 'Withdraw ALL',
  activityCounterpartyFrom: 'from',
  activityCounterpartyTo: 'to',
  activityAllFunds: 'All Funds',
  copyAddressAria: 'Copy address',
  refreshBalancesAria: 'Refresh balances',
  backAria: 'Back',
  dataError: 'Unable to load vault details.'
};

export const vaultDetailInsufficientWithdrawCopyByNamespace = {
  eip155:
    'Insufficient balance to withdraw - remaining funds are below the estimated gas cost.',
  bip122:
    'Insufficient balance to withdraw - remaining funds are below the estimated transaction fee.'
} as const satisfies WithdrawDisabledMessageByNamespace;

export const vaultDetailUnsupportedAssetWithdrawCopy =
  'Unsupported token balances cannot be withdrawn in this version.';

export const vaultAlertCopy = {
  vulnerableTitle: 'Vulnerable',
  vulnerableBody:
    'This vault is vulnerable. Withdraw funds to a quantum safe vault.',
  pendingTitle: 'Transaction pending',
  pendingBody: 'Do not send new funds to this vault',
  withdrawnBody: 'Do not send new funds to this vault',
  pendingConfirmationBody: (chainName: string) =>
    `Waiting for ${chainName} network confirmation`,
  undoAction: 'Undo'
};

export const vaultSuccessCopy = {
  title: 'Successfully Withdrawn',
  body: (sourceLabel: string, destinationLabel: string) =>
    `All funds from ${sourceLabel} have been withdrawn to ${destinationLabel}`,
  viewTxAction: 'View Withdrawal Tx'
};

export const withdrawFlowCopy = {
  warningTitle: 'Warning',
  warningBody:
    'Withdrawing from the vault will expose your assets to quantum risk.\n\nAll assets will be withdrawn to a single address.',
  continueAction: 'CONTINUE',
  backAction: 'CANCEL',
  suggestionBody: (vaultLabel: string) =>
    `${vaultLabel} is SAFE. Would you like to move assets directly there?`,
  suggestionYes: 'YES',
  suggestionNo: 'NO, WITHDRAW TO EXTERNAL WALLET',
  fullBalanceWithdrawHelper:
    'A withdrawal will send your full vault balance. Partial withdrawals are not supported in the current version.',
  safeDestinationLookupError:
    'Unable to find a safe vault automatically. Enter an address to continue.',
  addAddressTitle: 'Withdraw Vault',
  addAddressFieldLabel: (chainName: string) =>
    `Enter your ${chainName} withdrawal address:`,
  addAddressPlaceholder: '0x...',
  reviewTitle: 'You will send',
  reviewToLegend: 'TO',
  reviewFeeLabel: 'TX FEES',
  reviewAddressLabel: (chainName: string) => `${chainName} Address`,
  cancelAction: 'CANCEL',
  confirmAction: 'CONFIRM',
  confirmWithdrawalAction: 'CONFIRM WITHDRAWAL'
};

export const depositFlowCopy = {
  selectNetworkTitle: 'Deposit',
  selectNetworkSubtitle: 'Select receiving network',
  loadingSafeVaults: 'Loading safe vaults...',
  safeVaultsError: 'Unable to load safe vaults.',
  noSafeVaults: 'No safe vaults are available for deposit.',
  selectNetworkWarning:
    'Sending assets on the wrong network will result in permanent loss. Verify the network before sending.',
  warningSubtitle: (chainSymbol: string, tokenFamily: string) =>
    chainSymbol === tokenFamily
      ? `Only send ${chainSymbol} to this address`
      : `Only send ${chainSymbol} / ${tokenFamily} to this address`,
  vaultAddressLabel: 'Vault Address',
  copyAddressAria: 'Copy address',
  copyAddressAction: 'Copy Address'
};

/**
 * Derived helpers kept alongside copy so the mapping stays in one place.
 */
export const getAlertTitle = (vulnerableCount: number) =>
  vulnerableCount === 1
    ? homeCopy.alertSingular
    : homeCopy.alertPlural(vulnerableCount);

export const getHomeAlertLine = ({
  vaultLabel,
  amount
}: {
  vaultLabel: string;
  amount: string;
}) => `${vaultLabel} - ${amount} ${homeCopy.atRiskSuffix}`;

export const getTokenCountLabel = (count: number) =>
  count === 1 ? vaultCardCopy.tokenSingular : vaultCardCopy.tokenPlural(count);

/** Zero-padded vault index for labels (ENG-1818). */
export const formatVaultNumberForDisplay = (vaultNumber: number): string =>
  vaultNumber.toString().padStart(2, '0');

export const getVaultName = ({
  chainName,
  vaultNumber
}: {
  chainName: string;
  vaultNumber: number;
}) => `${chainName} Vault #${formatVaultNumberForDisplay(vaultNumber)}`;
