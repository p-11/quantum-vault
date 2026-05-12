import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ScreenProps = {
  children: ReactNode;
  className?: string;
};

export const Screen = ({ children, className }: ScreenProps) => (
  <div
    className={cn(
      'flex flex-col p-4 min-h-(--popup-height) bg-background',
      className
    )}
  >
    {children}
  </div>
);
