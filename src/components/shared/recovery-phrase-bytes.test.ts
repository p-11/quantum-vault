import { describe, expect, it } from 'vitest';

import { sliceWordsBytes } from './recovery-phrase-bytes';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const buildMnemonicBytes = (words: ReadonlyArray<string>): Uint8Array =>
  textEncoder.encode(words.join(' '));

const decode = (bytes: Uint8Array): string => textDecoder.decode(bytes);

describe('sliceWordsBytes', () => {
  const twentyFourWords = Array.from(
    { length: 24 },
    (_, index) => `word${index + 1}`
  );
  const mnemonic = buildMnemonicBytes(twentyFourWords);

  it('returns the first 12 words for the first page', () => {
    const slice = sliceWordsBytes({
      mnemonic,
      startIndex: 0,
      wordsPerPage: 12
    });
    expect(decode(slice).split(' ')).toEqual(twentyFourWords.slice(0, 12));
  });

  it('returns the last 12 words for the second page', () => {
    const slice = sliceWordsBytes({
      mnemonic,
      startIndex: 12,
      wordsPerPage: 12
    });
    expect(decode(slice).split(' ')).toEqual(twentyFourWords.slice(12, 24));
  });

  it('returns a zero-length slice when startIndex is past the end', () => {
    const slice = sliceWordsBytes({
      mnemonic,
      startIndex: 24,
      wordsPerPage: 12
    });
    expect(slice.length).toBe(0);
  });

  it('returns a sub-page slice when fewer than wordsPerPage remain', () => {
    const slice = sliceWordsBytes({
      mnemonic,
      startIndex: 20,
      wordsPerPage: 12
    });
    expect(decode(slice).split(' ')).toEqual(twentyFourWords.slice(20, 24));
  });

  it('shares memory with the source mnemonic so callers control zeroization', () => {
    const slice = sliceWordsBytes({
      mnemonic,
      startIndex: 0,
      wordsPerPage: 1
    });
    expect(slice.buffer).toBe(mnemonic.buffer);
  });
});
