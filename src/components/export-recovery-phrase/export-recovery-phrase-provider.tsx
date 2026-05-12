import type { ReactNode } from 'react';

import { useExportRecoveryPhrase } from './use-export-recovery-phrase';
import { ExportRecoveryPhraseValueProvider } from './export-recovery-phrase-context';

export const ExportRecoveryPhraseProvider = ({
  children
}: {
  children: ReactNode;
}) => {
  const value = useExportRecoveryPhrase();
  return (
    <ExportRecoveryPhraseValueProvider value={value}>
      {children}
    </ExportRecoveryPhraseValueProvider>
  );
};
