const spaceByte = 0x20;

type SliceWordsBytesInput = {
  mnemonic: Uint8Array;
  startIndex: number;
  wordsPerPage: number;
};

// Locate the byte range covering `wordsPerPage` whitespace-separated words
// starting at `startIndex` (0-based) without decoding the full mnemonic.
// Decoding the full Uint8Array produces a 200-character JS string holding
// every word, plus a 24-element split() array - all immutable and all
// leaked to the V8 string heap until GC runs. Slicing first means only
// the currently visible page reaches the heap; the rest of the secret
// stays in the caller-owned, zeroable Uint8Array.
export const sliceWordsBytes = ({
  mnemonic,
  startIndex,
  wordsPerPage
}: SliceWordsBytesInput): Uint8Array => {
  let cursor = 0;
  let wordsSkipped = 0;

  while (wordsSkipped < startIndex && cursor < mnemonic.length) {
    if (mnemonic[cursor] === spaceByte) {
      wordsSkipped += 1;
    }
    cursor += 1;
  }

  const pageStart = cursor;
  let wordsCollected = 0;

  while (wordsCollected < wordsPerPage && cursor < mnemonic.length) {
    if (mnemonic[cursor] === spaceByte) {
      wordsCollected += 1;
      if (wordsCollected === wordsPerPage) {
        break;
      }
    }
    cursor += 1;
  }

  return mnemonic.subarray(pageStart, cursor);
};
