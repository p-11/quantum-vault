import { useCurrency } from '@/hooks/use-currency';
import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { ensurePresent } from '@/lib/assert';
import {
  getAlertTitle,
  getHomeAlertLine,
  getVaultName,
  homeCopy
} from '@/lib/copy';
import { formatCurrencyValue } from '@/lib/currency';
import { vaultStatuses } from '@/modules/vaults/core';
import { useVaultAccountSnapshotsQuery } from '@/modules/vaults/data/hooks';
import {
  buildAccountChainByReference,
  getTotalBalanceFromAccountSnapshots,
  getVaultNumberByAccountId,
  type TotalBalanceFromAccountSnapshotsResult
} from '@/modules/vaults/data/mappers/vault';
import { resolveVaultLifecycleAccountReadModel } from '@/modules/vaults/lifecycle/account-read-model';
import {
  AlertBanner,
  type AlertBannerLine
} from '@/modules/vaults/shared/alert-banner';
import {
  DepositArrowIcon,
  SettingsGearIcon
} from '@/modules/vaults/shared/icons';
import { BalanceRefreshButton } from '@/modules/vaults/shared/balance-refresh-button';
import { MatchQuery } from '@/components/ui/match-query';
import { TotalBalance } from '@/modules/vaults/shared/total-balance';
import { useManualBalanceRefresh } from '@/modules/vaults/shared/use-manual-balance-refresh';
import { vaultCardHeightClassName } from '@/modules/vaults/shared/vault-card';
import { VaultSection } from '@/modules/vaults/shared/vault-section';
import { Screen } from './screen';
import { Button } from './ui/button';
import { CenterAbsolutely } from './ui/center-absolutely';
import { Skeleton } from './ui/skeleton';
import type { WithdrawSyncStatus } from '@/providers/wallet-provider';

const homeSkeletonIds = ['skeleton-1', 'skeleton-2', 'skeleton-3'] as const;

type ActiveWithdrawSyncStatus = Exclude<WithdrawSyncStatus, 'idle'>;

const homeSyncBannerCopyByState: Record<
  ActiveWithdrawSyncStatus,
  { title: string; text: string }
> = {
  syncing: {
    title: homeCopy.syncStateSyncingTitle,
    text: homeCopy.syncStateSyncingBody
  },
  timeout: {
    title: homeCopy.syncStateTimeoutTitle,
    text: homeCopy.syncStateTimeoutBody
  },
  failed: {
    title: homeCopy.syncStateFailedTitle,
    text: homeCopy.syncStateFailedBody
  }
};

const getHomeSyncBannerLineId = (state: ActiveWithdrawSyncStatus): string =>
  `home-withdrawal-sync-${state}`;

const resolveHomeSyncBanner = (state: WithdrawSyncStatus) => {
  if (state === 'idle') {
    return undefined;
  }
  return {
    ...homeSyncBannerCopyByState[state],
    lineId: getHomeSyncBannerLineId(state)
  };
};

export const HomeScreen = () => {
  const { navigate } = useScreen();
  const { currency } = useCurrency();
  const { isRefreshingBalances, refreshBalancesManually } =
    useManualBalanceRefresh();
  const {
    accounts,
    selectAccount,
    sessionId,
    vault,
    withdrawSyncState,
    clearWithdrawSyncState,
    latestWithdrawalRecordByAccountId
  } = useWallet();
  const withdrawalReconciliationState = withdrawSyncState.status;
  const isWithdrawalReconciliationDismissable =
    withdrawalReconciliationState === 'failed' ||
    withdrawalReconciliationState === 'timeout';

  const vaultSnapshotsQuery = useVaultAccountSnapshotsQuery({
    accounts,
    vault,
    currency,
    sessionId
  });
  const vaultSnapshotByAccountId = vaultSnapshotsQuery.data ?? {};
  const isVaultSnapshotLoading = vaultSnapshotsQuery.isPending;
  const isVaultSnapshotError = vaultSnapshotsQuery.isError;

  const accountChainByReference = buildAccountChainByReference(
    vault.getSupportedChains()
  );
  const vaultNumberByAccountId = getVaultNumberByAccountId(accounts);
  const lifecycleReadModel = resolveVaultLifecycleAccountReadModel({
    accounts,
    vaultSnapshotByAccountId,
    latestWithdrawalRecordByAccountId
  });
  const accountsByStatus = lifecycleReadModel.accountsByHomeStatus;
  const homeSyncBanner = resolveHomeSyncBanner(withdrawalReconciliationState);
  const totalBalanceDisplay: TotalBalanceFromAccountSnapshotsResult =
    isVaultSnapshotError
      ? { kind: 'unavailable' }
      : getTotalBalanceFromAccountSnapshots({
          lifecycleAccounts: lifecycleReadModel.accounts
        });

  const vulnerableAlertLines: Array<AlertBannerLine> = isVaultSnapshotError
    ? []
    : accountsByStatus.vulnerable.flatMap(account => {
        const accountId = account.id.toString();
        const snapshot = ensurePresent(
          vaultSnapshotByAccountId[accountId],
          `vault snapshot for account ${accountId}`
        );
        if (snapshot.isUnavailable) {
          return [];
        }
        const chainMetadata = ensurePresent(
          accountChainByReference[account.chainId.reference],
          `chain metadata for ${account.chainId.reference}`
        );
        const vaultNumber = ensurePresent(
          vaultNumberByAccountId[accountId],
          `vault number for account ${accountId}`
        );
        const vaultLabel = getVaultName({
          chainName: chainMetadata.name,
          vaultNumber
        });
        const atRisk = ensurePresent(
          snapshot.totalBalance,
          'vulnerable vault snapshot total balance'
        );
        return [
          {
            id: accountId,
            text: getHomeAlertLine({
              vaultLabel,
              amount: formatCurrencyValue(atRisk, currency)
            })
          }
        ];
      });

  const handleSelectAccount = (
    account: Parameters<typeof selectAccount>[0]
  ) => {
    selectAccount(account);
    navigate('vault-detail');
  };

  return (
    <Screen className='max-h-(--popup-height) overflow-y-auto px-4 pb-4 pt-8'>
      <div className='-mx-4 flex h-10 items-center justify-between border-b border-popover px-4'>
        <div className='flex h-10 items-center justify-between'>
          <h1 className='type-title-bar m-0'>{homeCopy.title}</h1>
        </div>
        <div className='flex items-center gap-1'>
          <BalanceRefreshButton
            ariaLabel={homeCopy.refreshBalancesAria}
            isRefreshing={isRefreshingBalances}
            testId='home-refresh-balances-button'
            onClick={refreshBalancesManually}
          />
          <button
            aria-label={homeCopy.settingsAria}
            type='button'
            data-testid='settings-button'
            className='flex size-8 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
            onClick={() => navigate('settings')}
          >
            <SettingsGearIcon aria-hidden='true' />
          </button>
        </div>
      </div>

      {vulnerableAlertLines.length > 0 && (
        <AlertBanner
          tone='danger'
          title={getAlertTitle(vulnerableAlertLines.length)}
          lines={vulnerableAlertLines}
          fullBleed
          className='mt-4'
        />
      )}
      {homeSyncBanner ? (
        <AlertBanner
          data-testid='home-withdraw-sync-banner'
          data-sync-status={withdrawalReconciliationState}
          tone='warning'
          title={homeSyncBanner.title}
          lines={[
            {
              id: homeSyncBanner.lineId,
              text: homeSyncBanner.text
            }
          ]}
          fullBleed
          className={vulnerableAlertLines.length > 0 ? 'mt-2' : 'mt-4'}
          onDismiss={
            isWithdrawalReconciliationDismissable
              ? clearWithdrawSyncState
              : undefined
          }
          dismissAriaLabel={homeCopy.syncStateDismissAria}
          dismissButtonTestId='home-withdraw-sync-banner-dismiss-button'
        />
      ) : null}

      <div className='-mx-4 border-b border-popover px-4 pb-4 pt-4'>
        <TotalBalance
          label={homeCopy.totalBalanceLabel}
          value={
            totalBalanceDisplay.kind === 'value'
              ? totalBalanceDisplay.value
              : null
          }
          currency={currency}
          isLoading={isVaultSnapshotLoading}
        />

        <div className='mt-8 flex gap-2'>
          <Button
            className='h-11 w-full gap-2 rounded-none type-label uppercase'
            onClick={() => navigate('receive')}
          >
            <DepositArrowIcon className='size-4' />
            {homeCopy.depositAction}
          </Button>
        </div>
      </div>

      <div data-testid='home-sections' className='flex flex-col gap-4 pt-4'>
        <MatchQuery
          value={vaultSnapshotsQuery}
          loading={() => (
            <div className='flex flex-col gap-2'>
              {homeSkeletonIds.map(id => (
                <Skeleton
                  key={id}
                  className={`${vaultCardHeightClassName} w-full`}
                />
              ))}
            </div>
          )}
          error={() => (
            <div className='relative min-h-[222px]'>
              <CenterAbsolutely>
                <p className='type-body-sm text-footer-muted'>
                  {homeCopy.vaultSnapshotsError}
                </p>
              </CenterAbsolutely>
            </div>
          )}
          success={() =>
            vaultStatuses
              .filter(status => accountsByStatus[status].length > 0)
              .map(status => (
                <VaultSection
                  key={status}
                  status={status}
                  accounts={accountsByStatus[status]}
                  accountChainByReference={accountChainByReference}
                  vaultNumberByAccountId={vaultNumberByAccountId}
                  vaultSnapshotByAccountId={vaultSnapshotByAccountId}
                  getLifecycleKindForAccountId={
                    lifecycleReadModel.getLifecycleKindForAccountId
                  }
                  onSelectAccount={handleSelectAccount}
                />
              ))
          }
        />
      </div>
    </Screen>
  );
};
