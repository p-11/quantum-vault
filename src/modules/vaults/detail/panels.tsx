import {
  CheckCircleIcon,
  CircleArrowLeftIcon,
  ShieldCheckIcon,
  type LucideIcon,
  MoveDownIcon,
  MoveUpIcon
} from 'lucide-react';
import type { Asset, PersistedAccount } from '@project-eleven/libqc';
import type { ReactNode } from 'react';

import { BalanceInCurrencyText } from '@/components/currency/balance-in-currency-text';
import { ensurePresent } from '@/lib/assert';
import { vaultAlertCopy, vaultDetailCopy, vaultSuccessCopy } from '@/lib/copy';
import { match } from '@/lib/match';
import { cn, formatAssetBalance, shortenAddress } from '@/lib/utils';
import type { VaultStatus } from '@/modules/vaults/core';
import type { VaultLifecycleKind } from '@/modules/vaults/lifecycle/core';
import type { VaultLifecycleStatus } from '@/modules/vaults/lifecycle/types';
import { resolveAssetIconUrl } from '@/modules/vaults/shared/asset-icon';
import { AlertBanner } from '@/modules/vaults/shared/alert-banner';

import {
  buildBalanceBySymbol,
  formatActivityAmount,
  getTxExplorerMetadataFromRef,
  getTxUrlFromRef,
  isRecordlessWithdrawnLifecycle,
  resolveLifecycleDestinationAddress,
  resolveActivityDateLabel,
  resolveLifecycleDestinationLabel,
  resolveLifecycleTxRef,
  resolveWithdrawnActivityFallbackMetadata,
  getLatestOutboundActivity,
  resolveSuccessStateIconKind,
  vaultStatusToCurrencyClassNames,
  type SuccessLifecycleKind,
  type SuccessStateIconKind
} from './core';
import type { VaultData } from './types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type VaultDetailFundsPanelProps = {
  chainName: string;
  chainIconUrl: string;
  vaultTitle: string;
  vaultData: VaultData | undefined;
  vaultState: VaultStatus;
  lifecycleKind: VaultLifecycleKind;
  lifecycleStatus: VaultLifecycleStatus;
  vaultLabelByLookupKey: Record<string, string>;
  selectedChainId: PersistedAccount['chainId'];
};

const successIconByKind: Record<SuccessStateIconKind, LucideIcon> = {
  check: CheckCircleIcon,
  'withdraw-to-safe': ShieldCheckIcon
};

export const VaultDetailFundsPanel = ({
  chainName,
  chainIconUrl,
  vaultTitle,
  vaultData,
  vaultState,
  lifecycleKind,
  lifecycleStatus,
  vaultLabelByLookupKey,
  selectedChainId
}: VaultDetailFundsPanelProps) => {
  if (!vaultData) {
    return (
      <div className='px-4 py-2'>
        <Skeleton className='mb-2 h-[74px] w-full' />
        <Skeleton className='h-[74px] w-full' />
      </div>
    );
  }

  const renderPendingFundsState = () => {
    const pendingOutboundActivity = getLatestOutboundActivity(
      vaultData.activities
    );
    const txRef = resolveLifecycleTxRef({
      lifecycleStatus,
      fallbackTxRef: pendingOutboundActivity?.txRef ?? null
    });

    return <PendingFundsState chainName={chainName} txRef={txRef} />;
  };

  const renderWithdrawnFundsState = ({
    successLifecycleKind
  }: {
    successLifecycleKind: SuccessLifecycleKind;
  }) => {
    // Recordless withdrawn vaults (recovered exposed-empty wallets) have no
    // local proof the user authored the drain. The latest outbound activity
    // is plausibly an attacker's transaction, so we MUST NOT borrow it as
    // the displayed withdrawal destination/txRef.
    const canTrustActivityFallback =
      !isRecordlessWithdrawnLifecycle(lifecycleStatus);
    const withdrawnActivityFallbackMetadata = canTrustActivityFallback
      ? resolveWithdrawnActivityFallbackMetadata(vaultData.activities)
      : { destinationAddress: null, txRef: null };
    const destinationAddress = resolveLifecycleDestinationAddress({
      lifecycleStatus,
      fallbackDestinationAddress:
        withdrawnActivityFallbackMetadata.destinationAddress
    });
    const destinationLabel =
      destinationAddress === null
        ? '--'
        : resolveLifecycleDestinationLabel({
            destinationAddress,
            vaultLabelByLookupKey,
            selectedChainId
          });

    const txRef = resolveLifecycleTxRef({
      lifecycleStatus,
      fallbackTxRef: withdrawnActivityFallbackMetadata.txRef
    });

    return (
      <WithdrawnFundsState
        lifecycleKind={successLifecycleKind}
        onChainVaultStatus={vaultData.onChainVaultStatus}
        sourceLabel={vaultTitle}
        destinationLabel={destinationLabel}
        txRef={txRef}
      />
    );
  };

  const renderAssetRows = () => {
    const balanceBySymbol = buildBalanceBySymbol(vaultData.balances);

    return (
      <div>
        {vaultData.assets.map(asset => {
          const balance = ensurePresent(
            balanceBySymbol[asset.symbol],
            `balance for ${asset.symbol}`
          );

          return (
            <VaultFundsRow
              key={asset.symbol}
              asset={asset}
              balance={balance}
              chainIconUrl={chainIconUrl}
              vaultState={vaultState}
            />
          );
        })}
      </div>
    );
  };

  return match<VaultLifecycleKind, ReactNode>(lifecycleKind, {
    safe: renderAssetRows,
    vulnerable: renderAssetRows,
    pending: renderPendingFundsState,
    sent: () =>
      renderWithdrawnFundsState({
        successLifecycleKind: 'sent'
      }),
    withdrawn: () =>
      renderWithdrawnFundsState({
        successLifecycleKind: 'withdrawn'
      })
  });
};

type PendingFundsStateProps = {
  chainName: string;
  txRef: string | null;
};

const PendingFundsState = ({ chainName, txRef }: PendingFundsStateProps) => {
  const txUrl = getTxUrlFromRef(txRef);

  return (
    <div
      className='flex flex-1 min-h-0 flex-col justify-between'
      data-testid='vault-detail-funds-state-pending'
      data-tx-ref={txRef ?? ''}
      data-has-tx-url={txUrl ? 'true' : 'false'}
    >
      <AlertBanner
        tone='warning'
        title={vaultAlertCopy.pendingTitle}
        lines={[
          {
            id: 'pending-funds-confirmation',
            text: vaultAlertCopy.pendingConfirmationBody(chainName)
          }
        ]}
      />
      <div className='px-4 pb-4 pt-4'>
        <Button
          className='h-11 w-full rounded-none type-label uppercase'
          variant='secondary'
          disabled={!txUrl}
          data-testid='vault-detail-funds-view-tx-button'
          data-state='pending'
          data-has-tx-url={txUrl ? 'true' : 'false'}
          onClick={() => {
            if (txUrl) {
              window.open(txUrl, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          {vaultSuccessCopy.viewTxAction}
        </Button>
      </div>
    </div>
  );
};

const VaultFundsRow = ({
  asset,
  balance,
  chainIconUrl,
  vaultState
}: {
  asset: Asset;
  balance: bigint;
  chainIconUrl: string;
  vaultState: VaultStatus;
}) => {
  const currencyClassName =
    vaultStatusToCurrencyClassNames[vaultState].valueClassName;
  const mutedCurrencyClassName =
    vaultStatusToCurrencyClassNames[vaultState].mutedValueClassName;

  return (
    <div className='flex items-center justify-between border-b border-popover px-4 py-4'>
      <div className='flex min-w-0 items-center gap-3'>
        <img
          src={resolveAssetIconUrl({
            asset,
            chainIconUrl
          })}
          className='size-11 bg-secondary object-cover p-1'
          alt={`${asset.name} icon`}
        />
        <div className='min-w-0'>
          <p className='type-body truncate'>{asset.name}</p>
          <p className='type-body text-footer-muted'>
            {formatAssetBalance(balance, asset)}
          </p>
        </div>
      </div>

      <BalanceInCurrencyText
        balance={balance}
        asset={asset}
        className={cn('type-body-medium', currencyClassName)}
        mutedClassName={mutedCurrencyClassName}
      />
    </div>
  );
};

type WithdrawnFundsStateProps = {
  lifecycleKind: SuccessLifecycleKind;
  onChainVaultStatus: VaultStatus;
  sourceLabel: string;
  destinationLabel: string;
  txRef: string | null;
};

const WithdrawnFundsState = ({
  lifecycleKind,
  onChainVaultStatus,
  sourceLabel,
  destinationLabel,
  txRef
}: WithdrawnFundsStateProps) => {
  const bodyPrefix = vaultSuccessCopy.body(sourceLabel, '');
  const txUrl = getTxUrlFromRef(txRef);
  const successIconKind = resolveSuccessStateIconKind({
    lifecycleKind,
    onChainVaultStatus
  });
  const SuccessIcon = successIconByKind[successIconKind];

  return (
    <div
      className='flex flex-1 min-h-0 flex-col justify-between'
      data-testid='vault-detail-funds-state-withdrawn'
      data-lifecycle-kind={lifecycleKind}
      data-on-chain-vault-status={onChainVaultStatus}
      data-tx-ref={txRef ?? ''}
      data-has-tx-url={txUrl ? 'true' : 'false'}
    >
      <div className='flex flex-1 items-center justify-center'>
        <div className='flex w-full flex-col items-center justify-center gap-4'>
          <div
            className='flex size-11 items-center justify-center rounded-full border border-success/40 text-success'
            data-testid='vault-detail-funds-state-icon'
            data-icon-kind={successIconKind}
          >
            <SuccessIcon className='size-6' />
          </div>

          <div className='flex w-full flex-col items-center gap-2 px-4 text-center'>
            <p className='type-title-bar'>{vaultSuccessCopy.title}</p>
            <p className='text-xs leading-4 text-footer-muted'>
              {bodyPrefix}
              <span
                className='text-foreground'
                data-testid='vault-detail-funds-destination-label'
                data-destination-label={destinationLabel}
              >
                {destinationLabel}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className='px-4 pb-4 pt-4'>
        <Button
          className='h-11 w-full rounded-none type-label uppercase'
          variant='secondary'
          disabled={!txUrl}
          data-testid='vault-detail-funds-view-tx-button'
          data-state='withdrawn'
          data-has-tx-url={txUrl ? 'true' : 'false'}
          onClick={() => {
            if (txUrl) {
              window.open(txUrl, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          {vaultSuccessCopy.viewTxAction}
        </Button>
      </div>
    </div>
  );
};

type ActivityRowVariant = 'withdraw-all' | 'inbound' | 'outbound';

type ActivityIconKind = 'up' | 'down' | 'left';

const activityIconByKind: Record<ActivityIconKind, LucideIcon> = {
  up: MoveUpIcon,
  down: MoveDownIcon,
  left: CircleArrowLeftIcon
};

const activityLabelPrefixByVariant: Record<ActivityRowVariant, string> = {
  'withdraw-all': vaultDetailCopy.activityDirectionWithdrawAll,
  inbound: vaultDetailCopy.activityDirectionReceived,
  outbound: vaultDetailCopy.activityDirectionSent
};

const activityCounterpartyPrefixByVariant: Record<ActivityRowVariant, string> =
  {
    'withdraw-all': vaultDetailCopy.activityCounterpartyTo,
    inbound: vaultDetailCopy.activityCounterpartyFrom,
    outbound: vaultDetailCopy.activityCounterpartyTo
  };

const activityAmountClassByVariant: Record<ActivityRowVariant, string> = {
  'withdraw-all': 'type-body-tight text-warning',
  inbound: 'type-body-tight text-success',
  outbound: 'type-body-tight text-warning'
};

const activityIconContainerClassByVariant: Record<ActivityRowVariant, string> =
  {
    'withdraw-all': 'bg-warning/10 text-foreground',
    inbound: 'bg-success/10 text-foreground',
    outbound: 'bg-secondary text-foreground'
  };

const activityIconKindByVariant: Record<ActivityRowVariant, ActivityIconKind> =
  {
    'withdraw-all': 'up',
    inbound: 'down',
    outbound: 'left'
  };

const getActivityRowVariant = ({
  isWithdrawAllRow,
  isInbound
}: {
  isWithdrawAllRow: boolean;
  isInbound: boolean;
}): ActivityRowVariant => {
  if (isWithdrawAllRow) {
    return 'withdraw-all';
  }

  if (isInbound) {
    return 'inbound';
  }

  return 'outbound';
};

type VaultDetailActivityPanelProps = {
  vaultData: VaultData | undefined;
  isActivityLoading: boolean;
  vaultState: VaultStatus;
  lifecycleStatus: VaultLifecycleStatus;
};

export const VaultDetailActivityPanel = ({
  vaultData,
  isActivityLoading,
  vaultState,
  lifecycleStatus
}: VaultDetailActivityPanelProps) => {
  if (!vaultData || isActivityLoading) {
    return (
      <div className='px-4 py-2'>
        <Skeleton className='mb-2 h-[74px] w-full' />
        <Skeleton className='h-[74px] w-full' />
      </div>
    );
  }

  if (!vaultData.activities.length) {
    return (
      <p
        className='type-body px-4 py-6 text-footer-muted'
        data-testid='vault-detail-activity-empty'
      >
        {vaultDetailCopy.activityEmpty}
      </p>
    );
  }

  const withdrawnActivityId =
    vaultState === 'withdrawn' &&
    !isRecordlessWithdrawnLifecycle(lifecycleStatus)
      ? getLatestOutboundActivity(vaultData.activities)?.id
      : undefined;

  return (
    <div data-testid='vault-detail-activity-list'>
      {vaultData.activities.map(activity => (
        <VaultActivityRow
          key={activity.id}
          activity={activity}
          isWithdrawAllRow={activity.id === withdrawnActivityId}
        />
      ))}
    </div>
  );
};

const VaultActivityRow = ({
  activity,
  isWithdrawAllRow
}: {
  activity: VaultData['activities'][number];
  isWithdrawAllRow: boolean;
}) => {
  const isInbound = activity.direction === 'inbound';
  const variant = getActivityRowVariant({ isWithdrawAllRow, isInbound });
  const directionLabel = activityLabelPrefixByVariant[variant];
  const counterpartyLabel = activityCounterpartyPrefixByVariant[variant];
  const amountPrefix = isInbound ? '+' : '-';
  const iconContainerClassName = activityIconContainerClassByVariant[variant];
  const amountClassName = activityAmountClassByVariant[variant];
  const iconKind = activityIconKindByVariant[variant];
  const ActivityIcon = activityIconByKind[iconKind];
  const amountLabel =
    variant === 'withdraw-all'
      ? vaultDetailCopy.activityAllFunds
      : `${amountPrefix}${formatActivityAmount({
          amount: activity.amount,
          decimals: activity.decimals
        })}`;
  const activityLabel =
    variant === 'withdraw-all'
      ? directionLabel
      : `${directionLabel} ${activity.symbol}`;
  const counterpartyAddressLabel =
    activity.counterparty.trim().length > 0
      ? shortenAddress(activity.counterparty)
      : '--';
  const activityDateLabel = resolveActivityDateLabel({
    timestamp: activity.timestamp,
    blockNumber: activity.blockNumber
  });
  const txExplorerMetadata = getTxExplorerMetadataFromRef(activity.txRef);
  const content = (
    <>
      <div className='flex min-w-0 items-center gap-3'>
        <div
          className={cn(
            'flex size-[42px] items-center justify-center',
            iconContainerClassName
          )}
          data-testid='vault-detail-activity-icon'
          data-icon-kind={iconKind}
        >
          <ActivityIcon className='size-5' />
        </div>

        <div className='min-w-0'>
          <p
            className='truncate text-sm leading-none font-normal'
            data-testid='vault-detail-activity-label'
          >
            {activityLabel}
          </p>
          <p
            className='mt-2 truncate text-sm leading-none text-footer-muted'
            data-testid='vault-detail-activity-counterparty'
            data-counterparty={activity.counterparty}
          >
            {counterpartyLabel} {counterpartyAddressLabel}
          </p>
        </div>
      </div>

      <div className='text-right'>
        <p
          className={amountClassName}
          data-testid='vault-detail-activity-amount'
          data-amount-label={amountLabel}
        >
          {amountLabel}
        </p>
        <p
          className='mt-2 text-sm leading-none text-foreground'
          data-testid='vault-detail-activity-date'
        >
          {activityDateLabel}
        </p>
      </div>
    </>
  );

  if (!txExplorerMetadata) {
    return (
      <div
        className='flex w-full items-center justify-between border-b border-popover px-4 py-4 text-left'
        data-testid='vault-detail-activity-row'
        data-activity-id={activity.id}
        data-variant={variant}
        data-direction={activity.direction}
        data-symbol={activity.symbol}
        data-tx-ref={activity.txRef ?? ''}
        data-has-tx-url='false'
      >
        {content}
      </div>
    );
  }

  return (
    <a
      href={txExplorerMetadata.url}
      target='_blank'
      rel='noopener noreferrer'
      aria-label={`View ${activity.symbol} transaction on ${txExplorerMetadata.name}`}
      className='flex w-full items-center justify-between border-b border-popover px-4 py-4 text-left transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
      data-testid='vault-detail-activity-row'
      data-activity-id={activity.id}
      data-variant={variant}
      data-direction={activity.direction}
      data-symbol={activity.symbol}
      data-tx-ref={activity.txRef ?? ''}
      data-has-tx-url='true'
    >
      {content}
    </a>
  );
};
