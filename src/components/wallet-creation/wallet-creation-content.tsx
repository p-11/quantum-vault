import {
  AnimateScreen,
  type AnimateScreenOptions
} from '@/components/animate-screen';
import { Screen } from '@/components/screen';
import { CancelConfirmationModal } from '@/components/shared/cancel-confirmation-modal';
import { CreatingWalletLoader } from '@/components/shared/creating-wallet-loader';
import { useBoolean } from '@/hooks/use-boolean';
import { useScreen } from '@/hooks/use-screen';
import { useStepNavigation } from '@/hooks/use-step-navigation';
import { attempt } from '@/lib/attempt';
import { toastMessages } from '@/lib/content';
import { zeroOut } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';
import {
  type ReactNode,
  useCallback,
  type RefObject,
  useEffect,
  useRef,
  useState
} from 'react';
import { toast } from 'sonner';

import { walletCreationSteps, type WalletCreationStep } from './core';
import { BackupPromptStep } from './steps/backup-prompt-step';
import { PasswordStep } from './steps/password-step';
import { SeedRevealStep } from './steps/seed-reveal-step';
import { SuccessStep } from './steps/success-step';
import { VerifyPromptStep } from './steps/verify-prompt-step';
import { WordVerificationStep } from './steps/word-verification-step';
import { useWalletCreationContext } from './wallet-creation-context';

const forwardSlideAnimateOptions: AnimateScreenOptions = {
  direction: 'forward',
  type: 'slide'
};

const backSlideAnimateOptions: AnimateScreenOptions = {
  direction: 'back',
  type: 'slide'
};

const forwardFadeAnimateOptions: AnimateScreenOptions = {
  direction: 'forward',
  type: 'fade'
};

type WalletCreationStepRenderersInput = {
  handleBack: () => void;
  handleCompleteCreation: () => void;
  handleNext: () => void;
  handleOpenVault: () => void;
  handlePasswordSubmit: () => void;
  handleSuccessReady: () => void;
  passwordInputRef: RefObject<HTMLInputElement | null>;
  passwordConfirmationInputRef: RefObject<HTMLInputElement | null>;
};

const getStepRenderers = ({
  handleBack,
  handleCompleteCreation,
  handleNext,
  handleOpenVault,
  handlePasswordSubmit,
  handleSuccessReady,
  passwordInputRef,
  passwordConfirmationInputRef
}: WalletCreationStepRenderersInput) =>
  ({
    password: () => (
      <PasswordStep
        onSubmit={handlePasswordSubmit}
        onBack={handleBack}
        passwordInputRef={passwordInputRef}
        passwordConfirmationInputRef={passwordConfirmationInputRef}
      />
    ),
    'backup-prompt': () => (
      <BackupPromptStep
        onReveal={handleNext}
        onSkip={handleCompleteCreation}
        onBack={handleBack}
      />
    ),
    'seed-reveal': () => (
      <SeedRevealStep onNext={handleNext} onBack={handleBack} />
    ),
    'verify-prompt': () => (
      <VerifyPromptStep
        onConfirm={handleNext}
        onSkip={handleCompleteCreation}
        onBack={handleBack}
      />
    ),
    'word-verification': () => (
      <WordVerificationStep
        onConfirm={handleCompleteCreation}
        onBack={handleBack}
      />
    ),
    success: () => (
      <SuccessStep onContinue={handleOpenVault} onReady={handleSuccessReady} />
    )
  }) satisfies Record<WalletCreationStep, () => ReactNode>;

export const WalletCreationContent = () => {
  const { navigate } = useScreen();
  const walletCreation = useWalletCreationContext();
  const { clearSensitiveState, clearConfirmIdentityCooldown } = walletCreation;
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passwordConfirmationInputRef = useRef<HTMLInputElement>(null);
  const [showCancelConfirmation, cancelConfirmation] = useBoolean();
  const [animateScreenOptions, setAnimateScreenOptions] =
    useState<AnimateScreenOptions>(forwardSlideAnimateOptions);

  const { currentStep, toNextStep, toPreviousStep, goToStep } =
    useStepNavigation({
      steps: walletCreationSteps,
      onExit: cancelConfirmation.set
    });

  useEffect(() => {
    return () => {
      zeroOut(passwordInputRef);
      zeroOut(passwordConfirmationInputRef);
      clearSensitiveState();
      clearConfirmIdentityCooldown();
    };
  }, [clearConfirmIdentityCooldown, clearSensitiveState]);

  const passwordValidation = walletCreation.passwordValidation;
  const passwordsMatch = walletCreation.passwordsMatch;

  const handleNext = () => {
    setAnimateScreenOptions(forwardSlideAnimateOptions);
    toNextStep();
  };

  const handleBack = () => {
    setAnimateScreenOptions(backSlideAnimateOptions);
    toPreviousStep();
  };

  const handlePasswordSubmit = async () => {
    if (!passwordValidation.valid || !passwordsMatch) {
      return;
    }

    zeroOut(passwordInputRef);
    zeroOut(passwordConfirmationInputRef);

    const result = await attempt(() => walletCreation.submitPassword());
    if ('error' in result) {
      toast.error(toastMessages.unexpectedError);
      return;
    }
    if (!result.data) {
      return;
    }
    handleNext();
  };

  const handleCompleteCreation = async () => {
    if (walletCreation.isCreatingWallet) {
      return;
    }

    setAnimateScreenOptions(forwardFadeAnimateOptions);
    const result = await attempt(() => walletCreation.createWallet());
    if ('error' in result) {
      toast.error(toastMessages.walletCreationFailed);
      return;
    }
    if (!result.data) {
      return;
    }
    goToStep('success');
  };

  const handleCancelConfirm = async () => {
    if (walletCreation.isSettingPassword || walletCreation.isCreatingWallet) {
      return;
    }

    const result = await attempt(() => walletCreation.cancelCreation());
    if ('error' in result) {
      toast.error(toastMessages.unexpectedError);
      return;
    }
    navigate('initial', { direction: 'back' });
  };

  const handleOpenVault = () => {
    clearSensitiveState();
    navigate('home', { direction: 'forward' });
  };

  const handleSuccessReady = useCallback(() => {
    clearSensitiveState();
    clearConfirmIdentityCooldown();
  }, [clearConfirmIdentityCooldown, clearSensitiveState]);

  const stepRenderers = getStepRenderers({
    handleBack,
    handleCompleteCreation,
    handleNext,
    handleOpenVault,
    handleSuccessReady,
    handlePasswordSubmit,
    passwordInputRef,
    passwordConfirmationInputRef
  });

  return (
    <>
      <Screen className='sharp'>
        <div className='flex flex-1 flex-col overflow-hidden'>
          <AnimatePresence
            mode='wait'
            custom={animateScreenOptions}
            initial={false}
          >
            <AnimateScreen
              key={currentStep}
              custom={animateScreenOptions}
              className='flex flex-1 flex-col'
            >
              {walletCreation.isCreatingWallet ? (
                <CreatingWalletLoader />
              ) : (
                stepRenderers[currentStep]()
              )}
            </AnimateScreen>
          </AnimatePresence>
        </div>
      </Screen>

      <CancelConfirmationModal
        open={showCancelConfirmation}
        onConfirm={handleCancelConfirm}
        onDismiss={cancelConfirmation.unset}
        isConfirmDisabled={
          walletCreation.isSettingPassword || walletCreation.isCreatingWallet
        }
      />
    </>
  );
};
