import { SmileIcon } from 'lucide-react';

import { FlowStepFooter } from '@/components/shared/flow-step-footer';
import { FlowStepHeader } from '@/components/shared/flow-step-header';
import { AlertCard } from '@/components/ui/alert-card';
import { Button } from '@/components/ui/button';

import { walletCreationStepContainerClassName } from '../core';
import { useWalletCreationContext } from '../wallet-creation-context';

type VerifyPromptStepProps = {
  onConfirm: () => void;
  onSkip: () => void;
  onBack: () => void;
};

export const VerifyPromptStep = ({
  onConfirm,
  onSkip,
  onBack
}: VerifyPromptStepProps) => {
  const { isCreatingWallet: isSubmitting } = useWalletCreationContext();

  return (
    <div className={walletCreationStepContainerClassName}>
      <div>
        <FlowStepHeader
          title='Verify Your Backup?'
          description='Confirming your phrase takes 30 seconds and proves your backup is correct.'
          onBack={onBack}
          backDisabled={isSubmitting}
        />

        <div className='mt-8'>
          <AlertCard
            icon={<SmileIcon />}
            title='Recommended'
            description='Verifying your phrase ensures you wrote it down correctly.'
          />
        </div>
      </div>

      <FlowStepFooter>
        <Button size='flow' onClick={onConfirm} disabled={isSubmitting}>
          Confirm Now
        </Button>

        <Button
          variant='ghost'
          size='flow'
          onClick={onSkip}
          disabled={isSubmitting}
        >
          Do This Later
        </Button>
      </FlowStepFooter>
    </div>
  );
};
