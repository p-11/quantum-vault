import { cn } from '@/lib/utils';

type RecoveryPhraseWordGridProps = {
  words: string[];
  isRevealed: boolean;
  startIndex?: number;
};

export const RecoveryPhraseWordGrid = ({
  words,
  isRevealed,
  startIndex = 0
}: RecoveryPhraseWordGridProps) => (
  <div
    className={cn(
      'grid grid-cols-3 gap-2 transition-[filter] duration-200',
      !isRevealed && 'blur'
    )}
    aria-hidden={!isRevealed}
  >
    {words.map((word, index) => (
      <div
        key={startIndex + index}
        className='flex h-11 items-center gap-1.5 border border-border bg-input px-2.5 py-1 text-sm font-medium'
      >
        {startIndex + index + 1}. {word}
      </div>
    ))}
  </div>
);
