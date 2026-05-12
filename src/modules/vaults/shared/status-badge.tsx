import { cn } from '@/lib/utils';
import { match } from '@/lib/match';
import { vaultDetailCopy } from '@/lib/copy';
import type { StatusBadgeKind } from './status-badge-core';

type StatusBadgeProps = {
  kind: StatusBadgeKind;
  className?: string;
};

const kindToClassName: Record<StatusBadgeKind, string> = {
  safe: 'bg-success/15 text-success',
  vulnerable: 'bg-destructive/15 text-destructive',
  withdrawn: 'bg-secondary text-foreground'
};

const kindToLabel = (kind: StatusBadgeKind): string =>
  match(kind, {
    safe: () => vaultDetailCopy.safeBadge,
    vulnerable: () => vaultDetailCopy.vulnerableBadge,
    withdrawn: () => vaultDetailCopy.withdrawnBadge
  });

/**
 * Vault status chip used on Vault Detail headers (Figma 32:1597, 44:5123,
 * 43:4152, 44:3776, 44:8676, 44:8696). Padding + white stroke taken
 * directly from Figma spec.
 */
export const StatusBadge = ({ kind, className }: StatusBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 type-caption font-medium uppercase tracking-wide',
      kindToClassName[kind],
      className
    )}
  >
    {kindToLabel(kind)}
  </span>
);
