import { SmileIcon } from 'lucide-react';

import { FlowStepFooter } from '@/components/shared/flow-step-footer';
import { FlowStepHeader } from '@/components/shared/flow-step-header';
import { AlertCard } from '@/components/ui/alert-card';
import { Button } from '@/components/ui/button';

import { walletCreationStepContainerClassName } from '../core';
import { useWalletCreationContext } from '../wallet-creation-context';

type BackupPromptStepProps = {
  onReveal: () => void;
  onSkip: () => void;
  onBack: () => void;
};

export const BackupPromptStep = ({
  onReveal,
  onSkip,
  onBack
}: BackupPromptStepProps) => {
  const { isCreatingWallet: isSubmitting } = useWalletCreationContext();

  return (
    <div className={walletCreationStepContainerClassName}>
      <div>
        <FlowStepHeader
          title='Back Up your Recovery Phrase'
          description='Your recovery phrase is the only way to restore this wallet. If you lose it, you lose access.'
          onBack={onBack}
          backDisabled={isSubmitting}
        />

        <div className='mt-8'>
          <AlertCard
            icon={<SmileIcon />}
            title='Keep it offline'
            description='Write it down and store it somewhere safe. Avoid screenshots and cloud notes.'
          />
        </div>
      </div>

      <FlowStepFooter>
        <Button size='flow' onClick={onReveal} disabled={isSubmitting}>
          Reveal Recovery Phrase
        </Button>

        <Button
          variant='ghost'
          size='flow'
          onClick={onSkip}
          disabled={isSubmitting}
          data-testid='wallet-creation-skip-backup'
        >
          Not Now
        </Button>
      </FlowStepFooter>
    </div>
  );
};
