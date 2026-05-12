import { cn, shortenAddress } from '@/lib/utils';
import { vaultAlertCopy, vaultDetailCopy } from '@/lib/copy';
import { toastMessages } from '@/lib/content';
import type { CurrencyCode } from '@/lib/currency';
import { match } from '@/lib/match';
import { CurrencyValueText } from '@/components/currency/currency-value-text';
import type { VaultStatus } from '@/modules/vaults/core';
import type { VaultLifecycleKind } from '@/modules/vaults/lifecycle/core';
import {
  AlertBanner,
  type AlertBannerLine
} from '@/modules/vaults/shared/alert-banner';
import {
  DepositArrowIcon,
  WithdrawArrowIcon
} from '@/modules/vaults/shared/icons';
import { StatusBadge } from '@/modules/vaults/shared/status-badge';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BalanceRefreshButton } from '@/modules/vaults/shared/balance-refresh-button';
import { useManualBalanceRefresh } from '@/modules/vaults/shared/use-manual-balance-refresh';
import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { shouldHideVaultDetailActions } from './action-visibility';
import { getVaultDetailDisplayedTotalCurrencyValue } from './balance-display';
import {
  vaultStatusToCurrencyClassNames,
  type WithdrawAvailability
} from './core';
import type { VaultData } from './types';

type VaultDetailHeaderProps = {
  selectedAddress: string;
  title: string;
  vaultState: VaultStatus;
  onBack(): void;
};

export const VaultDetailHeader = ({
  selectedAddress,
  title,
  vaultState,
  onBack
}: VaultDetailHeaderProps) => {
  const { isRefreshingBalances, refreshBalancesManually } =
    useManualBalanceRefresh();

  const copyAddressToClipboard = () => {
    navigator.clipboard.writeText(selectedAddress);
    toast.success(toastMessages.copiedToClipboard);
  };

  return (
    <div className='p-4'>
      <div className='mb-5 flex items-center justify-between'>
        <BackButton
          testId='vault-detail-back-button'
          label={vaultDetailCopy.backAria}
          onClick={onBack}
        />
        <BalanceRefreshButton
          ariaLabel={vaultDetailCopy.refreshBalancesAria}
          isRefreshing={isRefreshingBalances}
          testId='vault-detail-refresh-balances-button'
          onClick={refreshBalancesManually}
        />
      </div>

      <h1 className='type-heading-lg'>{title}</h1>

      <div className='mt-3 flex items-center gap-2'>
        <div className='flex items-center gap-0.5'>
          <p className='type-body text-footer-muted'>
            {shortenAddress(selectedAddress)}
          </p>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label={vaultDetailCopy.copyAddressAria}
            data-testid='vault-detail-copy-address-button'
            className='size-6 rounded-none text-footer-muted hover:bg-foreground/5 hover:text-foreground'
            onClick={copyAddressToClipboard}
          >
            <CopyIcon className='size-4' />
          </Button>
        </div>
        <StatusBadge kind={vaultState} />
      </div>
    </div>
  );
};

type VaultDetailStatusBannerProps = {
  lifecycleKind: VaultLifecycleKind;
};

type VaultDetailBanner = {
  tone: 'danger' | 'warning';
  title?: string;
  lines: ReadonlyArray<AlertBannerLine>;
};

const lifecycleKindToBanner: Record<
  VaultLifecycleKind,
  VaultDetailBanner | null
> = {
  safe: null,
  vulnerable: {
    tone: 'danger',
    lines: [
      {
        id: 'vulnerable-banner-body',
        text: vaultAlertCopy.vulnerableBody
      }
    ]
  },
  pending: {
    tone: 'danger',
    lines: [
      {
        id: 'pending-banner-body',
        text: vaultAlertCopy.pendingBody
      }
    ]
  },
  sent: {
    tone: 'danger',
    lines: [
      {
        id: 'sent-banner-body',
        text: vaultAlertCopy.pendingBody
      }
    ]
  },
  withdrawn: {
    tone: 'danger',
    lines: [
      {
        id: 'withdrawn-banner-body',
        text: vaultAlertCopy.withdrawnBody
      }
    ]
  }
};

export const VaultDetailStatusBanner = ({
  lifecycleKind
}: VaultDetailStatusBannerProps) => {
  const banner = lifecycleKindToBanner[lifecycleKind];
  if (banner) {
    return (
      <div
        data-testid='vault-lifecycle-banner'
        data-lifecycle-kind={lifecycleKind}
      >
        <AlertBanner
          tone={banner.tone}
          title={banner.title}
          lines={banner.lines}
        />
      </div>
    );
  }

  return null;
};

type VaultDetailBalanceSectionProps = {
  vaultData: VaultData | undefined;
  vaultState: VaultStatus;
  lifecycleKind: VaultLifecycleKind;
  currency: CurrencyCode;
  withdrawAvailability: WithdrawAvailability;
  isDataUnavailable?: boolean;
  onDeposit(): void;
  onWithdraw(): void;
};

export const VaultDetailBalanceSection = ({
  vaultData,
  vaultState,
  lifecycleKind,
  currency,
  withdrawAvailability,
  isDataUnavailable = false,
  onDeposit,
  onWithdraw
}: VaultDetailBalanceSectionProps) => {
  const displayedTotalCurrencyValue = getVaultDetailDisplayedTotalCurrencyValue(
    {
      vaultData,
      lifecycleKind
    }
  );

  return (
    <div className='border-b border-popover px-4 pb-4 pt-4'>
      <p className='type-title-bar text-footer-muted'>TOTAL BALANCE</p>
      <p
        className={cn(
          'type-value-xl mt-1',
          vaultStatusToCurrencyClassNames[vaultState].valueClassName
        )}
      >
        {displayedTotalCurrencyValue !== undefined ? (
          <CurrencyValueText
            value={displayedTotalCurrencyValue}
            currency={currency}
            mutedClassName={
              vaultStatusToCurrencyClassNames[vaultState].mutedValueClassName
            }
          />
        ) : isDataUnavailable ? (
          <span className='text-footer-muted'>--</span>
        ) : (
          <Skeleton className='h-9 w-40' />
        )}
      </p>

      <VaultDetailActions
        lifecycleKind={lifecycleKind}
        vaultState={vaultState}
        withdrawAvailability={withdrawAvailability}
        onDeposit={onDeposit}
        onWithdraw={onWithdraw}
      />
    </div>
  );
};

type VaultDetailActionsProps = {
  lifecycleKind: VaultLifecycleKind;
  vaultState: VaultStatus;
  withdrawAvailability: WithdrawAvailability;
  onDeposit(): void;
  onWithdraw(): void;
};

type VaultDetailActionsLayout =
  | 'hidden'
  | 'single-withdraw'
  | 'deposit-only'
  | 'deposit-and-withdraw';

const resolveVaultDetailActionsLayout = ({
  vaultState,
  withdrawAvailability
}: {
  vaultState: VaultStatus;
  withdrawAvailability: WithdrawAvailability;
}): VaultDetailActionsLayout => {
  const isWithdrawHidden = withdrawAvailability.kind === 'hidden';

  return match(vaultState, {
    safe: (): VaultDetailActionsLayout =>
      isWithdrawHidden ? 'deposit-only' : 'deposit-and-withdraw',
    vulnerable: (): VaultDetailActionsLayout =>
      isWithdrawHidden ? 'hidden' : 'single-withdraw',
    withdrawn: (): VaultDetailActionsLayout =>
      !isWithdrawHidden ? 'single-withdraw' : 'hidden'
  });
};

const WithdrawDisabledMessage = ({ message }: { message: string }) => (
  <p className='mt-2 type-body-tight text-destructive'>{message}</p>
);

const singleWithdrawLabelByVaultState: Record<VaultStatus, string> = {
  safe: vaultDetailCopy.withdrawAction,
  vulnerable: vaultDetailCopy.withdrawToSafeAction,
  withdrawn: vaultDetailCopy.withdrawAction
};

const VaultDetailActions = ({
  lifecycleKind,
  vaultState,
  withdrawAvailability,
  onDeposit,
  onWithdraw
}: VaultDetailActionsProps) => {
  if (shouldHideVaultDetailActions({ lifecycleKind })) {
    return null;
  }

  const layout = resolveVaultDetailActionsLayout({
    vaultState,
    withdrawAvailability
  });
  const withdrawDisabledMessage =
    withdrawAvailability.kind === 'disabled'
      ? withdrawAvailability.message
      : null;
  const isWithdrawDisabled = withdrawDisabledMessage !== null;

  return match(layout, {
    hidden: () => null,
    'single-withdraw': () => (
      <div className='mt-6'>
        <Button
          data-testid='vault-detail-withdraw-button'
          className='h-11 w-full gap-2 rounded-none type-label uppercase'
          disabled={isWithdrawDisabled}
          onClick={onWithdraw}
        >
          <WithdrawArrowIcon className='size-4' />
          {singleWithdrawLabelByVaultState[vaultState]}
        </Button>
        {withdrawDisabledMessage ? (
          <WithdrawDisabledMessage message={withdrawDisabledMessage} />
        ) : null}
      </div>
    ),
    'deposit-only': () => (
      <div className='mt-6'>
        <Button
          className='h-11 w-full gap-2 rounded-none type-label uppercase'
          onClick={onDeposit}
        >
          <DepositArrowIcon className='size-4' />
          {vaultDetailCopy.depositAction}
        </Button>
        {withdrawDisabledMessage ? (
          <WithdrawDisabledMessage message={withdrawDisabledMessage} />
        ) : null}
      </div>
    ),
    'deposit-and-withdraw': () => (
      <div className='mt-6'>
        <div className='flex gap-2'>
          <Button
            className='h-11 flex-1 gap-2 rounded-none type-label uppercase'
            onClick={onDeposit}
          >
            <DepositArrowIcon className='size-4' />
            {vaultDetailCopy.depositAction}
          </Button>
          <Button
            data-testid='vault-detail-withdraw-button'
            className='h-11 flex-1 gap-2 rounded-none type-label uppercase'
            variant='secondary'
            disabled={isWithdrawDisabled}
            onClick={onWithdraw}
          >
            <WithdrawArrowIcon className='size-4' />
            {vaultDetailCopy.withdrawAction}
          </Button>
        </div>
        {withdrawDisabledMessage ? (
          <WithdrawDisabledMessage message={withdrawDisabledMessage} />
        ) : null}
      </div>
    )
  });
};
