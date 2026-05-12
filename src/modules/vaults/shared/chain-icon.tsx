import { cn } from '@/lib/utils';

type ChainIconProps = {
  iconUrl: string;
  className?: string;
};

/**
 * Chain icon used on Home vault rows.
 * Dimensions mirror Figma Frame 56 left-column icon (42 x 42).
 */
export const ChainIcon = ({ iconUrl, className }: ChainIconProps) => (
  <img
    src={iconUrl}
    className={cn('size-10.5 shrink-0 object-cover', className)}
    alt='Vault icon'
  />
);
