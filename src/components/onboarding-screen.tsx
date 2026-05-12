import { useScreen } from '@/hooks/use-screen';
import { useClickGate } from '@/hooks/use-click-gate';
import { useStepNavigation } from '@/hooks/use-step-navigation';
import { markOnboardingSeen } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import { OnboardingIllustration } from './onboarding-illustration';
import { Screen } from './screen';
import { Button } from './ui/button';

type DescriptionSegment = {
  text: string;
  highlighted?: boolean;
};

const onboardingSteps = ['quantum-safe', 'deposit', 'withdrawals'] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];

type OnboardingStepConfig = {
  title: string;
  description: readonly DescriptionSegment[];
  actionLabel: 'NEXT' | 'GET STARTED';
};

const onboardingStepConfig = {
  'quantum-safe': {
    title: 'Sensible quantum security',
    description: [
      { text: 'Quantum Vault ' },
      { text: 'secures', highlighted: true },
      {
        text: ' your assets against quantum computer attacks by storing them '
      },
      { text: 'behind a hash', highlighted: true },
      { text: '.' }
    ],
    actionLabel: 'NEXT'
  },
  deposit: {
    title: 'Deposit BTC & ETH',
    description: [
      { text: 'Send ' },
      { text: 'BTC', highlighted: true },
      { text: ' or ' },
      { text: 'ETH', highlighted: true },
      { text: ' to your Quantum Vault address to start ' },
      { text: 'protecting funds today', highlighted: true },
      { text: '.' }
    ],
    actionLabel: 'NEXT'
  },
  withdrawals: {
    title: 'Withdrawing breaks the vault',
    description: [
      { text: 'Withdrawing ' },
      { text: 'exposes', highlighted: true },
      {
        text: ' your public key on-chain, making funds '
      },
      { text: 'vulnerable', highlighted: true },
      { text: ' to potential quantum attackers.' }
    ],
    actionLabel: 'GET STARTED'
  }
} satisfies Record<OnboardingStep, OnboardingStepConfig>;

export const OnboardingScreen = () => {
  const { navigate } = useScreen();

  const { currentStep, currentStepIndex, isLastStep, toNextStep } =
    useStepNavigation({
      steps: onboardingSteps
    });

  const stepConfig = onboardingStepConfig[currentStep];
  const totalSteps = onboardingSteps.length;
  const currentStepNumber = currentStepIndex + 1;

  // Both Skip and GET STARTED finish onboarding: persist the seen flag
  // and hand off to the initial screen. Once the user has exited the
  // flow by either path, we never show it again.
  const gatedFinishOnboarding = useClickGate({
    handler: () => {
      markOnboardingSeen();
      navigate('initial', { direction: 'forward' });
    }
  });

  const handleNext = () => {
    if (isLastStep) {
      gatedFinishOnboarding();
      return;
    }

    toNextStep();
  };

  const handleSkip = () => {
    gatedFinishOnboarding();
  };

  return (
    <Screen className='sharp relative overflow-hidden p-0'>
      <div className='absolute inset-x-4 top-4 z-20 flex flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <div
            className='flex items-center gap-[5px]'
            role='progressbar'
            aria-valuenow={currentStepNumber}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Onboarding step ${currentStepNumber} of ${totalSteps}`}
          >
            {onboardingSteps.map((stepKey, index) => (
              <div
                key={stepKey}
                aria-hidden='true'
                className={cn(
                  'h-0.5 w-5',
                  index === currentStepIndex ? 'bg-success' : 'bg-footer-muted'
                )}
              />
            ))}
          </div>

          <button
            type='button'
            onClick={handleSkip}
            className='type-label text-muted-foreground transition-colors hover:text-foreground'
          >
            Skip
          </button>
        </div>

        <div className='flex flex-col gap-4'>
          <h1 className='type-heading-xl whitespace-pre-line text-foreground'>
            {stepConfig.title}
          </h1>
          <p className='type-body text-muted-foreground'>
            {stepConfig.description.map((segment, segmentIndex) => (
              <span
                key={`${currentStep}-description-${segmentIndex}`}
                className={segment.highlighted ? 'text-foreground' : undefined}
              >
                {segment.text}
              </span>
            ))}
          </p>
        </div>
      </div>

      <OnboardingIllustration step={currentStep} />

      <div className='absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2.5 px-4 pb-4 pt-2.5'>
        <Button size='flow' className='rounded-none' onClick={handleNext}>
          {stepConfig.actionLabel}
        </Button>
      </div>
    </Screen>
  );
};
