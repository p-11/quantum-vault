import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils', () => ({
  clearSecretRef: (secretRef: { current: Uint8Array }) => {
    secretRef.current.fill(0);
    secretRef.current = new Uint8Array();
  },
  clearOptionalSecretRef: (secretRef: { current: Uint8Array | undefined }) => {
    secretRef.current?.fill(0);
    secretRef.current = undefined;
  }
}));

import {
  clearExportRecoveryPhraseRefs,
  toOwnedRecoveryPhraseBytes
} from './export-recovery-phrase-secrets';

const textEncoder = new TextEncoder();

describe('toOwnedRecoveryPhraseBytes', () => {
  it('returns an owned copy and zeroes the source buffer', () => {
    const source = textEncoder.encode('alpha beta gamma');

    const ownedCopy = toOwnedRecoveryPhraseBytes(source);

    expect(Array.from(ownedCopy)).toEqual(
      Array.from(textEncoder.encode('alpha beta gamma'))
    );
    expect(ownedCopy.buffer).not.toBe(source.buffer);
    expect(Array.from(source)).toEqual(Array.from(source, () => 0));
  });
});

describe('clearExportRecoveryPhraseRefs', () => {
  it('increments request id and clears password + recovery phrase refs', () => {
    const passwordBytes = textEncoder.encode('Test12345678!');
    const recoveryPhraseBytes = textEncoder.encode(
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'
    );
    const activeRequestIdRef = { current: 11 };
    const passwordRef = { current: passwordBytes };
    const recoveryPhraseRef = { current: recoveryPhraseBytes };

    clearExportRecoveryPhraseRefs({
      activeRequestIdRef,
      passwordRef,
      recoveryPhraseRef
    });

    expect(activeRequestIdRef.current).toBe(12);
    expect(passwordRef.current.length).toBe(0);
    expect(recoveryPhraseRef.current).toBeUndefined();
    expect(Array.from(passwordBytes)).toEqual(
      Array.from(passwordBytes, () => 0)
    );
    expect(Array.from(recoveryPhraseBytes)).toEqual(
      Array.from(recoveryPhraseBytes, () => 0)
    );
  });
});
