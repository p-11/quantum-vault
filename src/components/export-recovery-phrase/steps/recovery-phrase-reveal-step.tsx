import { Fragment, type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { RecoveryPhraseWordGrid } from '@/components/shared/recovery-phrase-word-grid';
import { RevealedRecoveryPhrasePage } from '@/components/shared/revealed-recovery-phrase-page';
import { useBoolean } from '@/hooks/use-boolean';
import { attempt } from '@/lib/attempt';
import { toastMessages } from '@/lib/content';

import { exportRecoveryPhraseCopy } from '../export-recovery-phrase-copy';
import { useExportRecoveryPhraseContext } from '../export-recovery-phrase-context';

type RecoveryPhraseRevealStepProps = {
  onExit: () => void;
};

const wordsPerPage = 12;
const recoveryPhraseWordCount = 24;
const recoveryPhrasePageCount = recoveryPhraseWordCount / wordsPerPage;
const hiddenPageWords = Array.from({ length: wordsPerPage }, () => '----');
const textDecoder = new TextDecoder();

type RecoveryPhraseAction = {
  id: string;
  isVisible: boolean;
  render: () => ReactNode;
};

export const RecoveryPhraseRevealStep = ({
  onExit
}: RecoveryPhraseRevealStepProps) => {
  const { recoveryPhrase, isSubmittingPassword } =
    useExportRecoveryPhraseContext();
  const [isRevealed, revealed] = useBoolean();
  const [currentPage, setCurrentPage] = useState(0);
  const startIndex = currentPage * wordsPerPage;
  const isLastPage = currentPage === recoveryPhrasePageCount - 1;

  const handleCopy = async () => {
    if (recoveryPhrase === undefined) {
      toast.error(exportRecoveryPhraseCopy.missingPhrase.message);
      return;
    }

    const copyResult = await attempt(() =>
      navigator.clipboard.writeText(textDecoder.decode(recoveryPhrase))
    );

    if ('error' in copyResult) {
      toast.error(toastMessages.unexpectedError);
      return;
    }

    toast.success(toastMessages.copiedToClipboard);
  };

  const revealPhrase = () => {
    if (recoveryPhrase === undefined) {
      toast.error(exportRecoveryPhraseCopy.missingPhrase.message);
      return;
    }

    revealed.set();
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setCurrentPage(previous => previous - 1);
      return;
    }

    onExit();
  };

  const phraseActions: ReadonlyArray<RecoveryPhraseAction> = [
    {
      id: 'next-page',
      isVisible: isRevealed && currentPage < recoveryPhrasePageCount - 1,
      render: () => (
        <Button
          size='flow'
          variant='secondary'
          disabled={isSubmittingPassword}
          onClick={() => setCurrentPage(previous => previous + 1)}
        >
          {exportRecoveryPhraseCopy.reveal.nextPageAction}
        </Button>
      )
    },
    {
      id: 'copy',
      isVisible: isRevealed && isLastPage,
      render: () => (
        <Button
          size='flow'
          disabled={isSubmittingPassword}
          onClick={() => void handleCopy()}
        >
          {exportRecoveryPhraseCopy.reveal.copyAction}
        </Button>
      )
    },
    {
      id: 'reveal',
      isVisible: !isRevealed,
      render: () => (
        <Button
          size='flow'
          disabled={isSubmittingPassword}
          onClick={revealPhrase}
        >
          {exportRecoveryPhraseCopy.reveal.revealAction}
        </Button>
      )
    },
    {
      id: 'back',
      isVisible: true,
      render: () => (
        <Button
          size='flow'
          variant='secondary'
          disabled={isSubmittingPassword}
          onClick={handleBack}
        >
          {exportRecoveryPhraseCopy.reveal.exitAction}
        </Button>
      )
    }
  ];

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='min-h-0 flex-1 overflow-y-auto pb-4'>
        <BackButton
          onClick={handleBack}
          disabled={isSubmittingPassword}
          testId='export-recovery-phrase-back-button'
        />

        <div className='pt-3'>
          <h1 className='text-2xl font-normal leading-8 text-foreground'>
            {exportRecoveryPhraseCopy.reveal.title}
          </h1>
          <p className='pt-5 text-base font-normal leading-normal text-foreground'>
            {exportRecoveryPhraseCopy.reveal.description}
          </p>
          <p className='pt-4 text-xs font-normal leading-normal text-destructive'>
            {exportRecoveryPhraseCopy.reveal.warning}
          </p>
        </div>

        {isRevealed && (
          <div className='pt-6'>
            <p className='pb-4 text-xs font-normal leading-none text-foreground'>
              {exportRecoveryPhraseCopy.reveal.phraseLabel}
            </p>
            <div data-testid='export-secret-phrase'>
              {recoveryPhrase === undefined ? (
                <RecoveryPhraseWordGrid
                  words={hiddenPageWords}
                  isRevealed={false}
                  startIndex={startIndex}
                />
              ) : (
                <RevealedRecoveryPhrasePage
                  mnemonic={recoveryPhrase}
                  startIndex={startIndex}
                  wordsPerPage={wordsPerPage}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className='flex shrink-0 flex-col gap-4 pt-4'>
        {phraseActions
          .filter(action => action.isVisible)
          .map(action => (
            <Fragment key={action.id}>{action.render()}</Fragment>
          ))}
      </div>
    </div>
  );
};
