import { RefreshCwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { OnClickProp } from '@/lib/props';
import { cn } from '@/lib/utils';

type BalanceRefreshButtonProps = {
  ariaLabel: string;
  isRefreshing: boolean;
  testId: string;
} & OnClickProp;

export const BalanceRefreshButton = ({
  ariaLabel,
  isRefreshing,
  onClick,
  testId
}: BalanceRefreshButtonProps) => (
  <Button
    type='button'
    variant='ghost'
    size='icon-sm'
    aria-label={ariaLabel}
    aria-busy={isRefreshing}
    data-testid={testId}
    data-refreshing={isRefreshing}
    disabled={isRefreshing}
    className='rounded-sm text-foreground hover:bg-foreground/5 hover:text-foreground'
    onClick={onClick}
  >
    <RefreshCwIcon
      aria-hidden='true'
      strokeWidth={1}
      className={cn('size-6', isRefreshing && 'animate-spin')}
    />
  </Button>
);
