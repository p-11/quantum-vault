import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type CenterAbsolutelyProps = {
  children: ReactNode;
  className?: string;
};

export const CenterAbsolutely = ({
  children,
  className
}: CenterAbsolutelyProps) => (
  <div
    className={cn(
      'absolute inset-0 flex items-center justify-center text-center',
      className
    )}
  >
    {children}
  </div>
);
