import type { ReactElement, ReactNode } from 'react';

import { BackButton } from '@/components/ui/back-button';

type FlowStepHeaderProps = {
  title: ReactNode;
  description?: string | ReactElement;
  onBack?: () => void;
  backDisabled?: boolean;
  backLabel?: string;
  backTestId?: string;
};

export const FlowStepHeader = ({
  title,
  description,
  onBack,
  backDisabled = false,
  backLabel,
  backTestId
}: FlowStepHeaderProps) => (
  <div className='flex flex-col gap-3'>
    {onBack && (
      <BackButton
        onClick={onBack}
        disabled={backDisabled}
        label={backLabel}
        testId={backTestId}
      />
    )}
    <h1 className='type-heading-lg text-foreground'>{title}</h1>
    {typeof description === 'string' ? (
      <p className='text-base font-normal leading-normal text-muted-foreground'>
        {description}
      </p>
    ) : (
      description
    )}
  </div>
);
