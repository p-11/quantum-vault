export const walletRecoverySteps = ['phrase-entry', 'password'] as const;

export type WalletRecoveryStep = (typeof walletRecoverySteps)[number];

/**
 * libqc requires 24-word BIP-39 mnemonics. The Thrya recovery frame renders
 * the whole phrase inside a single growing chip surface - the container adds
 * rows as the user commits more words up to this cap.
 */
export const expectedRecoveryPhraseWordCount = 24;
