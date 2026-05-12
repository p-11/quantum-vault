import type {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  MouseEvent,
  Ref
} from 'react';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';

import { RecoveryPhraseChip } from './recovery-phrase-chip';

export type RecoveryPhraseInputHandle = {
  commitPendingWord: () => string | null;
};

type RecoveryPhraseInputProps = {
  ref?: Ref<RecoveryPhraseInputHandle>;
  words: readonly string[];
  maxWords: number;
  onAddWord: (word: string) => void;
  onAddWords: (words: readonly string[]) => void;
  onRemoveWordAt: (index: number) => void;
  onPendingWordChange?: (hasPendingWord: boolean) => void;
};

const whitespacePattern = /\s+/;
const emptyInput = '';
const firstChipNumber = 1;

const sanitizeWord = (raw: string): string => raw.trim().toLowerCase();

const parseCandidateWords = (raw: string): string[] =>
  raw
    .split(whitespacePattern)
    .map(sanitizeWord)
    .filter(word => word.length > 0);

/**
 * Hybrid chip-input for entering the complete recovery phrase.
 *
 * Thrya's recovery frame shows an empty textarea with a "Type or paste"
 * placeholder that transitions into a numbered chip grid as words are
 * committed. The container holds the full 24-word phrase in a single
 * surface, growing rows via flex-wrap as more words land.
 *
 * - Typing a space commits the current buffer as the next word.
 * - Pasting multi-word text splits on whitespace and commits each word.
 * - Backspace on an empty buffer pops the previously committed word.
 * - Each chip has an X affordance for targeted removal.
 * - Words are lowercased on commit to match the BIP-39 wordlist quickly;
 *   libqc re-normalizes on final validation either way.
 */
export const RecoveryPhraseInput = ({
  ref,
  words,
  maxWords,
  onAddWord,
  onAddWords,
  onRemoveWordAt,
  onPendingWordChange
}: RecoveryPhraseInputProps) => {
  const [currentInput, setCurrentInput] = useState(emptyInput);
  const inputRef = useRef<HTMLInputElement>(null);

  const isFull = words.length >= maxWords;
  const isEmptyState = words.length === 0 && currentInput === emptyInput;

  const commitBuffer = (): string | null => {
    const sanitized = sanitizeWord(currentInput);
    if (sanitized.length > 0 && !isFull) {
      onAddWord(sanitized);
      setCurrentInput(emptyInput);
      return sanitized;
    }
    setCurrentInput(emptyInput);
    return null;
  };

  useEffect(() => {
    if (!onPendingWordChange) {
      return;
    }
    onPendingWordChange(!isFull && sanitizeWord(currentInput).length > 0);
  }, [currentInput, isFull, onPendingWordChange]);

  useImperativeHandle(ref, () => ({
    commitPendingWord: commitBuffer
  }));

  const handleContainerClick = (event: MouseEvent<HTMLDivElement>) => {
    // Ignore clicks on children that already handle focus/removal.
    if (event.target !== event.currentTarget) {
      return;
    }
    inputRef.current?.focus();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;

    if (!whitespacePattern.test(nextValue)) {
      setCurrentInput(nextValue);
      return;
    }

    // Whitespace means one or more words were completed in the same input
    // payload. Normalize and commit each completed word in order.
    const parts = parseCandidateWords(nextValue);
    if (parts.length === 0) {
      setCurrentInput(emptyInput);
      return;
    }

    if (parts.length === 1) {
      onAddWord(parts[0]);
    } else {
      onAddWords(parts);
    }
    setCurrentInput(emptyInput);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitBuffer();
      return;
    }

    const isBackspaceOnEmpty =
      event.key === 'Backspace' &&
      currentInput === emptyInput &&
      words.length > 0;

    if (isBackspaceOnEmpty) {
      event.preventDefault();
      onRemoveWordAt(words.length - 1);
    }
  };

  const handleInputPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const clipboardText = event.clipboardData.getData('text');
    const parts = parseCandidateWords(clipboardText);
    if (parts.length <= 1) {
      // Let the browser insert the text; onChange will normalize on commit.
      return;
    }
    event.preventDefault();
    onAddWords(parts);
    setCurrentInput(emptyInput);
  };

  const handleInputBlur = () => {
    if (currentInput !== emptyInput) {
      commitBuffer();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className='bg-input border-border relative flex min-h-[142px] cursor-text flex-row flex-wrap content-start items-start gap-2 border p-2.5'
      data-testid='recovery-phrase-input'
    >
      {words.map((word, index) => {
        const displayNumber = firstChipNumber + index;
        return (
          <RecoveryPhraseChip
            key={`${displayNumber}-${word}`}
            number={displayNumber}
            word={word}
            onRemove={() => onRemoveWordAt(index)}
          />
        );
      })}
      {!isFull && (
        <input
          ref={inputRef}
          type='text'
          value={currentInput}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onPaste={handleInputPaste}
          onBlur={handleInputBlur}
          placeholder={isEmptyState ? 'Type or paste' : undefined}
          autoFocus
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='none'
          spellCheck={false}
          aria-label='Enter recovery phrase word'
          data-testid='recovery-phrase-word-input'
          className='text-foreground placeholder:text-muted-foreground flex min-w-[80px] flex-1 bg-transparent text-sm leading-tight outline-none'
        />
      )}
    </div>
  );
};
