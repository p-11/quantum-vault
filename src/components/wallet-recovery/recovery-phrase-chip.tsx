import { XIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

type RecoveryPhraseChipProps = {
  number: number;
  word: string;
  onRemove: () => void;
};

export const RecoveryPhraseChip = ({
  number,
  word,
  onRemove
}: RecoveryPhraseChipProps) => {
  const handleRemoveClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Prevent bubbling to the input container, which would refocus the input
    // and conflict with the caret positioning we rely on for typing flow.
    event.stopPropagation();
    onRemove();
  };

  return (
    <div
      className='inline-flex items-center gap-1 border border-border bg-background px-2 py-0.5'
      data-testid='recovery-phrase-chip'
    >
      <span className='text-foreground text-xs font-medium leading-tight'>
        {number}. {word}
      </span>
      <button
        type='button'
        onClick={handleRemoveClick}
        className='text-foreground hover:text-muted-foreground focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-[3px]'
        aria-label={`Remove word ${number}`}
      >
        <XIcon className='size-3' />
      </button>
    </div>
  );
};
