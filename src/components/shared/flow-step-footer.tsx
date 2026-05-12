import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type FlowStepFooterProps = {
  children: ReactNode;
  className?: string;
};

export const FlowStepFooter = ({
  children,
  className
}: FlowStepFooterProps) => (
  <div className={cn('flex flex-col gap-4 pt-4', className)}>{children}</div>
);
