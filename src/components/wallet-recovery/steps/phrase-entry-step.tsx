import { FlowStepFooter } from '@/components/shared/flow-step-footer';
import { FlowStepHeader } from '@/components/shared/flow-step-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ensurePresent } from '@/lib/assert';
import { toastMessages } from '@/lib/content';
import { cn } from '@/lib/utils';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { expectedRecoveryPhraseWordCount } from '../core';
import {
  RecoveryPhraseInput,
  type RecoveryPhraseInputHandle
} from '../recovery-phrase-input';
import { useWalletRecoveryContext } from '../wallet-recovery-context';

type PhraseEntryStepProps = {
  onBack: () => void;
  onSubmit: (words: readonly string[]) => void;
};

const textDecoder = new TextDecoder();

export const PhraseEntryStep = ({ onBack, onSubmit }: PhraseEntryStepProps) => {
  const { wordsBytes, setWords, isRecovering } = useWalletRecoveryContext();
  const [hasPendingWord, setHasPendingWord] = useState(false);
  const phraseInputRef = useRef<RecoveryPhraseInputHandle>(null);
  const words = useMemo(
    () => wordsBytes.map(wordBytes => textDecoder.decode(wordBytes)),
    [wordsBytes]
  );

  const effectiveWordCount = Math.min(
    expectedRecoveryPhraseWordCount,
    words.length + (hasPendingWord ? 1 : 0)
  );
  const canContinue = effectiveWordCount === expectedRecoveryPhraseWordCount;

  const handleAddWord = (word: string) => {
    setWords(currentWords => {
      if (currentWords.length >= expectedRecoveryPhraseWordCount) {
        return currentWords;
      }
      return [...currentWords, word];
    });
  };

  const handleAddWords = (newWords: readonly string[]) => {
    if (words.length + newWords.length > expectedRecoveryPhraseWordCount) {
      toast.error(toastMessages.invalidSecretPhrase);
      return;
    }

    setWords(currentWords => {
      const remainingCapacity =
        expectedRecoveryPhraseWordCount - currentWords.length;
      if (remainingCapacity <= 0) {
        return currentWords;
      }
      const accepted = newWords.slice(0, remainingCapacity);
      if (accepted.length === 0) {
        return currentWords;
      }
      return [...currentWords, ...accepted];
    });
  };

  const handleRemoveWordAt = (index: number) => {
    setWords(currentWords =>
      currentWords.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const handleContinue = () => {
    const pendingWord = hasPendingWord
      ? ensurePresent(
          phraseInputRef.current,
          'recovery phrase input ref for submit'
        ).commitPendingWord()
      : null;
    const phraseWords =
      pendingWord === null
        ? words
        : [...words, pendingWord].slice(0, expectedRecoveryPhraseWordCount);

    if (phraseWords.length !== expectedRecoveryPhraseWordCount) {
      return;
    }
    onSubmit(phraseWords);
  };

  return (
    <div className='flex flex-1 min-h-0 flex-col justify-between'>
      <div>
        <FlowStepHeader
          title='Recover Your Vault'
          description={`Enter your ${expectedRecoveryPhraseWordCount}-word recovery phrase in the correct order.`}
          onBack={onBack}
          backDisabled={isRecovering}
        />

        <div className='mt-8 flex flex-col gap-2'>
          <div className='flex items-baseline justify-between'>
            <Label className='text-foreground'>Recovery phrase</Label>
            <span
              className={cn(
                'text-sm font-normal leading-tight tabular-nums',
                canContinue ? 'text-success' : 'text-muted-foreground'
              )}
              data-testid='recovery-phrase-counter'
            >
              {effectiveWordCount}/{expectedRecoveryPhraseWordCount}
            </span>
          </div>

          <RecoveryPhraseInput
            ref={phraseInputRef}
            words={words}
            maxWords={expectedRecoveryPhraseWordCount}
            onAddWord={handleAddWord}
            onAddWords={handleAddWords}
            onRemoveWordAt={handleRemoveWordAt}
            onPendingWordChange={setHasPendingWord}
          />

          <p className='text-muted-foreground text-sm leading-tight'>
            Words should be separated by spaces
          </p>
        </div>
      </div>

      <FlowStepFooter>
        <Button
          size='flow'
          disabled={!canContinue || isRecovering}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </FlowStepFooter>
    </div>
  );
};
