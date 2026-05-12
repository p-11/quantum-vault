import { cn } from '@/lib/utils';
import type { VaultStatus } from '../core';
import { vaultStatusLabels } from '../core';

type SectionHeaderProps = {
  status: VaultStatus;
  count: number;
};

const statusToColor: Record<VaultStatus, string> = {
  vulnerable: 'text-destructive',
  safe: 'text-success',
  withdrawn: 'text-muted-foreground'
};

/**
 * "VULNERABLE · 3" style section heading above each Home vault group.
 * Color derives from the VaultStatus token (destructive / success /
 * muted-foreground for withdrawn).
 */
export const SectionHeader = ({ status, count }: SectionHeaderProps) => (
  <p
    data-testid={`home-section-header-${status}`}
    className={cn('type-caption font-normal uppercase', statusToColor[status])}
  >
    {vaultStatusLabels[status]} &middot; {count}
  </p>
);
