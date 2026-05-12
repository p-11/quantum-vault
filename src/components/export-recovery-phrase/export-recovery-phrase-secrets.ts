import { clearOptionalSecretRef, clearSecretRef } from '@/lib/utils';
import type { MutableRefObject } from 'react';

type ClearExportRecoveryPhraseRefsInput = {
  activeRequestIdRef: MutableRefObject<number>;
  passwordRef: MutableRefObject<Uint8Array>;
  recoveryPhraseRef: MutableRefObject<Uint8Array | undefined>;
};

export const clearExportRecoveryPhraseRefs = ({
  activeRequestIdRef,
  passwordRef,
  recoveryPhraseRef
}: ClearExportRecoveryPhraseRefsInput): void => {
  activeRequestIdRef.current += 1;
  clearSecretRef(passwordRef);
  clearOptionalSecretRef(recoveryPhraseRef);
};

export const toOwnedRecoveryPhraseBytes = (
  mnemonic: Uint8Array
): Uint8Array => {
  const ownedMnemonic = new Uint8Array(mnemonic);
  mnemonic.fill(0);
  return ownedMnemonic;
};
