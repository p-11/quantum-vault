import type { ReactNode } from 'react';

import { Screen } from '@/components/screen';
import { BackButton } from '@/components/ui/back-button';
import { cn } from '@/lib/utils';

type SettingsPageProps = {
  title: ReactNode;
  children: ReactNode;
  onBack: () => void;
  footer?: ReactNode;
  titleClassName?: string;
};

export const SettingsPage = ({
  title,
  children,
  onBack,
  footer,
  titleClassName
}: SettingsPageProps) => (
  <Screen className='sharp p-0'>
    <div className='flex min-h-(--popup-height) flex-col justify-between bg-background'>
      <div className='min-h-0'>
        <div className='px-4 pt-4'>
          <BackButton onClick={onBack} />
        </div>

        <h1
          className={cn(
            'px-4 pt-3 text-2xl font-normal leading-8 text-foreground',
            titleClassName
          )}
        >
          {title}
        </h1>

        {children}
      </div>

      {footer && <div className='flex flex-col gap-4 px-4 pb-4'>{footer}</div>}
    </div>
  </Screen>
);
