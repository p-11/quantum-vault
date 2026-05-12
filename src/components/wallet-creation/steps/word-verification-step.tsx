import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useInterval } from '@/hooks/use-interval';
import { FlowStepFooter } from '@/components/shared/flow-step-footer';
import { FlowStepHeader } from '@/components/shared/flow-step-header';
import { Button } from '@/components/ui/button';
import { toastMessages } from '@/lib/content';

import { walletCreationStepContainerClassName } from '../core';
import { maxConfirmIdentityAttempts } from '../constants';
import { useWalletCreationContext } from '../wallet-creation-context';

type WordVerificationStepProps = {
  onConfirm: () => void;
  onBack: () => void;
};

const challengeCount = 3;
const optionsPerChallenge = 4;
const textDecoder = new TextDecoder();
const missingMnemonicMessage =
  'Recovery phrase is unavailable in this session. Please go back and continue setup.';

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

type Challenge = {
  position: number;
  correctWord: string;
  options: Array<{ id: string; word: string }>;
};

const generateChallenges = (words: string[]): Challenge[] => {
  const indices = shuffleArray(
    Array.from({ length: words.length }, (_, i) => i)
  ).slice(0, challengeCount);

  indices.sort((a, b) => a - b);

  return indices.map(position => {
    const correctWord = words[position];

    const availableDistractors = [...new Set(words)].filter(
      word => word !== correctWord
    );
    const distractors = shuffleArray(availableDistractors).slice(
      0,
      optionsPerChallenge - 1
    );
    const options = shuffleArray([correctWord, ...distractors]).map(
      (word, optionIndex) => ({
        id: `${position}-${optionIndex}-${word}`,
        word
      })
    );

    return { position, correctWord, options };
  });
};

const challengePromptFormatter = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction'
});

const buildChallengeDescription = (challenges: Challenge[]): ReactElement => {
  const parts = challengePromptFormatter.formatToParts(
    challenges.map(c => `#${c.position + 1}`)
  );

  return (
    <p className='text-base font-normal leading-normal'>
      <span className='text-muted-foreground'>
        Select the requested words to verify your backup.
      </span>{' '}
      <span className='text-foreground'>
        Select word{' '}
        {parts.map((part, index) =>
          part.type === 'element' ? (
            <span
              key={`${index}-${part.type}`}
              className='font-medium text-warning'
            >
              {part.value}
            </span>
          ) : (
            part.value
          )
        )}
        .
      </span>
    </p>
  );
};

type HandleSelectInput = {
  position: number;
  word: string;
};

export const WordVerificationStep = ({
  onConfirm,
  onBack
}: WordVerificationStepProps) => {
  const {
    mnemonic,
    isCreatingWallet: isSubmitting,
    confirmIdentityFailedAttempts,
    confirmIdentityCooldownUntil,
    recordConfirmIdentityFailure,
    clearConfirmIdentityCooldown
  } = useWalletCreationContext();
  const hasReportedMissingMnemonicRef = useRef(false);

  useEffect(() => {
    if (mnemonic !== undefined || hasReportedMissingMnemonicRef.current) {
      return;
    }

    hasReportedMissingMnemonicRef.current = true;
    clearConfirmIdentityCooldown();
    toast.error(missingMnemonicMessage);
  }, [clearConfirmIdentityCooldown, mnemonic]);

  const mnemonicString = useMemo(
    () => (mnemonic === undefined ? '' : textDecoder.decode(mnemonic)),
    [mnemonic]
  );
  const mnemonicWords = useMemo(
    () => (mnemonicString.length === 0 ? [] : mnemonicString.split(' ')),
    [mnemonicString]
  );
  const [challenges] = useState(() => generateChallenges(mnemonicWords));
  const challengeDescription = useMemo(
    () => buildChallengeDescription(challenges),
    [challenges]
  );
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [cooldownNowMs, setCooldownNowMs] = useState(() => Date.now());

  useEffect(() => {
    setCooldownNowMs(Date.now());
  }, [confirmIdentityCooldownUntil]);

  const cooldownRemainingMs =
    confirmIdentityCooldownUntil === null
      ? 0
      : confirmIdentityCooldownUntil - cooldownNowMs;
  const isConfirmIdentityCoolingDown = cooldownRemainingMs > 0;
  const cooldownRemainingSeconds = Math.max(
    0,
    Math.ceil(cooldownRemainingMs / 1000)
  );

  useInterval({
    callback: () => {
      setCooldownNowMs(Date.now());
    },
    delay: isConfirmIdentityCoolingDown ? 1000 : null
  });

  const allSelected = Object.keys(selections).length === challengeCount;

  const handleSelect = ({ position, word }: HandleSelectInput) => {
    setSelections(prev => ({ ...prev, [position]: word }));
  };

  const handleConfirm = () => {
    if (isConfirmIdentityCoolingDown) {
      return;
    }

    const allCorrect = challenges.every(
      challenge => selections[challenge.position] === challenge.correctWord
    );

    if (!allCorrect) {
      recordConfirmIdentityFailure();
      toast.error(toastMessages.invalidSecretPhraseConfirmation);
      setSelections({});
      return;
    }

    onConfirm();
  };

  if (mnemonic === undefined) {
    return (
      <div className={walletCreationStepContainerClassName}>
        <div>
          <FlowStepHeader
            title='Confirm your Recovery Phrase'
            description='Recovery phrase data was cleared. Please go back and continue setup.'
            onBack={onBack}
            backDisabled={isSubmitting}
          />
        </div>

        <FlowStepFooter className='gap-2'>
          <Button size='flow' onClick={onBack} disabled={isSubmitting}>
            Go Back
          </Button>
        </FlowStepFooter>
      </div>
    );
  }

  return (
    <div className={walletCreationStepContainerClassName}>
      <div>
        <FlowStepHeader
          title='Confirm your Recovery Phrase'
          description={challengeDescription}
          onBack={onBack}
          backDisabled={isSubmitting}
        />

        <div className='mt-4 flex flex-col gap-4'>
          {challenges.map(challenge => (
            <div key={challenge.position} className='flex flex-col gap-2'>
              <p className='text-xs leading-none text-foreground'>
                Word #{challenge.position + 1}
              </p>
              <div className='grid grid-cols-2 gap-2'>
                {challenge.options.map(option => {
                  const isSelected =
                    selections[challenge.position] === option.word;

                  return (
                    <Button
                      key={option.id}
                      type='button'
                      variant='word-choice'
                      size='word-choice'
                      onClick={() =>
                        handleSelect({
                          position: challenge.position,
                          word: option.word
                        })
                      }
                      disabled={isSubmitting || isConfirmIdentityCoolingDown}
                      data-selected={isSelected}
                      className='w-full'
                    >
                      {option.word}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <FlowStepFooter className='gap-2'>
        {!isConfirmIdentityCoolingDown && confirmIdentityFailedAttempts > 0 ? (
          <p className='text-center text-xs text-muted-foreground'>
            Failed attempts: {confirmIdentityFailedAttempts}/
            {maxConfirmIdentityAttempts}
          </p>
        ) : null}

        {isConfirmIdentityCoolingDown ? (
          <p className='text-center text-xs text-warning'>
            Too many incorrect attempts. Please wait {cooldownRemainingSeconds}{' '}
            second
            {cooldownRemainingSeconds === 1 ? '' : 's'} before trying again.
          </p>
        ) : null}

        <Button
          size='flow'
          disabled={
            !allSelected || isSubmitting || isConfirmIdentityCoolingDown
          }
          onClick={handleConfirm}
        >
          Confirm
        </Button>

        <Button
          variant='ghost'
          size='flow'
          onClick={onBack}
          disabled={isSubmitting}
        >
          Go Back
        </Button>
      </FlowStepFooter>
    </div>
  );
};
