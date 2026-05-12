import type { ComponentPropsWithoutRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BackArrowIcon = (props: ComponentPropsWithoutRef<'svg'>) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    {...props}
  >
    <path
      d='M20.25 12H3.75M3.75 12L10.5 5.25M3.75 12L10.5 18.75'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

type BackButtonProps = {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  testId?: string;
  className?: string;
};

export const BackButton = ({
  onClick,
  label = 'Back',
  disabled = false,
  testId = 'back-button',
  className
}: BackButtonProps) => (
  <Button
    data-testid={testId}
    type='button'
    variant='inline'
    size='inline'
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={cn('size-6 p-0', className)}
  >
    <BackArrowIcon className='size-6' />
  </Button>
);
