import { RecoveryPhraseRevealStep } from '@/components/shared/recovery-phrase-reveal-step';
import { recoveryPhraseRevealCopy } from '@/components/shared/recovery-phrase-reveal-copy';

import { walletCreationStepContainerClassName } from '../core';
import { useWalletCreationContext } from '../wallet-creation-context';

type SeedRevealStepProps = {
  onNext: () => void;
  onBack: () => void;
};

const missingMnemonicMessage =
  'Recovery phrase is unavailable in this session. Please go back and continue setup.';

export const SeedRevealStep = ({ onNext, onBack }: SeedRevealStepProps) => {
  const { mnemonic, isCreatingWallet } = useWalletCreationContext();

  return (
    <RecoveryPhraseRevealStep
      mnemonic={mnemonic}
      title={recoveryPhraseRevealCopy.title}
      description={recoveryPhraseRevealCopy.description}
      missingPhraseDescription='Recovery phrase data was cleared. Please go back and continue setup.'
      missingPhraseMessage={missingMnemonicMessage}
      onBack={onBack}
      onNext={onNext}
      finalActionLabel={recoveryPhraseRevealCopy.finalActionLabel}
      isSubmitting={isCreatingWallet}
      className={walletCreationStepContainerClassName}
    />
  );
};
