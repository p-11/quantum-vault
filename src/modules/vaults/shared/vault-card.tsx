import type { PersistedAccount } from '@project-eleven/libqc';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { formatVaultNumberForDisplay } from '@/lib/copy';
import type { VaultStatus } from '../core';
import type { VaultLifecycleKind } from '../lifecycle/core';
import type { AccountChainMetadata, VaultSnapshot } from '../types';
import { shortenVaultAddress } from './address';
import { ChainIcon } from './chain-icon';
import { getVaultCardBalanceDisplay } from './vault-card-balance';
import {
  VaultCardBalanceContent,
  type VaultCardConfig
} from './vault-card-balance-content';

type VaultCardProps = {
  account: PersistedAccount;
  chainMetadata: AccountChainMetadata;
  status: VaultStatus;
  snapshot: VaultSnapshot;
  vaultNumber: number;
  lifecycleKind: VaultLifecycleKind;
  onSelect(account: PersistedAccount): void;
};

const statusToConfig: Record<VaultStatus, VaultCardConfig> = {
  vulnerable: {
    rowSurfaceClassName: 'border-b border-popover bg-destructive/5',
    titleClassName: 'text-foreground',
    addressClassName: 'text-footer-muted',
    tokenCountClassName: 'text-foreground',
    valueClassName: 'text-foreground',
    valueMutedClassName: 'text-footer-muted',
    iconClassName: ''
  },
  safe: {
    rowSurfaceClassName: '',
    titleClassName: 'text-foreground',
    addressClassName: 'text-footer-muted',
    tokenCountClassName: 'text-foreground',
    valueClassName: 'text-foreground',
    valueMutedClassName: 'text-footer-muted',
    iconClassName: ''
  },
  withdrawn: {
    rowSurfaceClassName: '',
    titleClassName: 'text-footer-muted/60',
    addressClassName: 'text-footer-muted/60',
    tokenCountClassName: 'text-footer-muted/60',
    valueClassName: 'text-footer-muted/60',
    valueMutedClassName: 'text-footer-muted/60',
    iconClassName: 'opacity-50'
  }
};

export const vaultCardHeightClassName = 'h-[74px]';

/**
 * Vault list-row used on Home (Figma Frame 56 inside each section).
 * Shows chain icon + vault label + address + balance/token count.
 * Status drives row-specific color treatment inside the section container.
 */
export const VaultCard = ({
  account,
  chainMetadata,
  status,
  snapshot,
  vaultNumber,
  lifecycleKind,
  onSelect
}: VaultCardProps) => {
  const { currency } = useCurrency();
  const config = statusToConfig[status];
  const balanceDisplay = getVaultCardBalanceDisplay({
    snapshot,
    lifecycleKind
  });

  return (
    <button
      type='button'
      data-address={account.address}
      data-testid='vault-card'
      aria-label={`${chainMetadata.name} vault ${formatVaultNumberForDisplay(vaultNumber)}`}
      className={cn(
        'relative flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        vaultCardHeightClassName,
        config.rowSurfaceClassName
      )}
      onClick={() => onSelect(account)}
    >
      <div className='flex items-center gap-2'>
        <ChainIcon
          iconUrl={chainMetadata.iconUrl}
          className={config.iconClassName}
        />
        <div className='flex flex-col gap-2'>
          <p
            className={cn('type-body-sm leading-[14px]', config.titleClassName)}
          >
            {`${chainMetadata.symbol} Vault #${formatVaultNumberForDisplay(vaultNumber)}`}
          </p>
          <p
            className={cn(
              'type-body-sm leading-[14px]',
              config.addressClassName
            )}
          >
            {shortenVaultAddress(account.address)}
          </p>
        </div>
      </div>

      <div className='flex flex-col items-end gap-2'>
        <VaultCardBalanceContent
          balance={balanceDisplay}
          config={config}
          currency={currency}
        />
      </div>
    </button>
  );
};
