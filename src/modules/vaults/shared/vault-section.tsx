import type { PersistedAccount } from '@project-eleven/libqc';
import { cn } from '@/lib/utils';
import { ensurePresent } from '@/lib/assert';
import type { VaultStatus } from '../core';
import type { VaultLifecycleKind } from '../lifecycle/core';
import type { AccountChainMetadata, VaultSnapshot } from '../types';
import { SectionHeader } from './section-header';
import { VaultCard } from './vault-card';

type VaultSectionProps = {
  status: VaultStatus;
  accounts: ReadonlyArray<PersistedAccount>;
  accountChainByReference: Record<string, AccountChainMetadata>;
  vaultNumberByAccountId: Record<string, number>;
  vaultSnapshotByAccountId: Partial<Record<string, VaultSnapshot>>;
  getLifecycleKindForAccountId(accountId: string): VaultLifecycleKind;
  onSelectAccount(account: PersistedAccount): void;
};

const statusToSectionSurfaceClassName: Record<VaultStatus, string> = {
  vulnerable: 'border-l-2 border-destructive',
  safe: 'border-l-2 border-success bg-success/5',
  withdrawn: 'border-l-2 border-muted-foreground/50 bg-secondary/40'
};

/**
 * A status-grouped Home section: header (`VULNERABLE · 2`) + card rows.
 * Extracted from `home-screen.tsx` to be reused by future surfaces that
 * list vaults filtered by status (e.g. Withdraw suggestion picker).
 */
export const VaultSection = ({
  status,
  accounts,
  accountChainByReference,
  vaultNumberByAccountId,
  vaultSnapshotByAccountId,
  getLifecycleKindForAccountId,
  onSelectAccount
}: VaultSectionProps) => (
  <section
    data-testid={`home-section-${status}`}
    data-status={status}
    className='-mx-4 flex flex-col gap-2'
  >
    <div className='px-4'>
      <SectionHeader status={status} count={accounts.length} />
    </div>
    <div
      className={cn('flex flex-col', statusToSectionSurfaceClassName[status])}
    >
      {accounts.map(account => {
        const accountId = account.id.toString();
        return (
          <VaultCard
            key={accountId}
            account={account}
            chainMetadata={ensurePresent(
              accountChainByReference[account.chainId.reference],
              `chain metadata for ${account.chainId.reference}`
            )}
            status={status}
            snapshot={ensurePresent(
              vaultSnapshotByAccountId[accountId],
              `vault snapshot for account ${accountId}`
            )}
            vaultNumber={ensurePresent(
              vaultNumberByAccountId[accountId],
              `vault number for account ${accountId}`
            )}
            lifecycleKind={getLifecycleKindForAccountId(accountId)}
            onSelect={onSelectAccount}
          />
        );
      })}
    </div>
  </section>
);
