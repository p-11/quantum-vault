import { RecoveryPhraseWordGrid } from '@/components/shared/recovery-phrase-word-grid';

import { sliceWordsBytes } from './recovery-phrase-bytes';

type RevealedRecoveryPhrasePageProps = {
  mnemonic: Uint8Array;
  startIndex: number;
  wordsPerPage: number;
};

const textDecoder = new TextDecoder();

export const RevealedRecoveryPhrasePage = ({
  mnemonic,
  startIndex,
  wordsPerPage
}: RevealedRecoveryPhrasePageProps) => {
  const pageBytes = sliceWordsBytes({ mnemonic, startIndex, wordsPerPage });
  const pageWords = textDecoder.decode(pageBytes).split(' ');

  return (
    <RecoveryPhraseWordGrid
      words={pageWords}
      isRevealed={true}
      startIndex={startIndex}
    />
  );
};
