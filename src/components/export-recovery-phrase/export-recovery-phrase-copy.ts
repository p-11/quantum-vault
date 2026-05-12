export const exportRecoveryPhraseCopy = {
  reveal: {
    title: 'Export Keys',
    description:
      'Your recovery phrase and private keys give full access to your wallet. Make sure no one is watching your screen.',
    warning: 'Never share it with anyone',
    phraseLabel: 'Recovery Phrase',
    nextPageAction: 'NEXT',
    revealAction: 'REVEAL KEYS',
    copyAction: 'COPY',
    exitAction: 'BACK'
  },
  cancelModal: {
    title: 'Stop export recovery phrase?',
    description:
      'Your recovery phrase has not been exported yet. If you stop now, re-enter your password to continue later.'
  },
  missingPhrase: {
    message:
      'Recovery phrase is unavailable in this session. Please re-enter your password.',
    description:
      'Recovery phrase data was cleared. Please re-enter your password to continue.'
  }
} as const;
