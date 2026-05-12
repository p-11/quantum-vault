import { setupValueProvider } from '@/lib/state';

import type { ExportRecoveryPhraseContextValue } from './use-export-recovery-phrase';

export const [
  ExportRecoveryPhraseValueProvider,
  useExportRecoveryPhraseContext
] = setupValueProvider<ExportRecoveryPhraseContextValue>(
  'ExportRecoveryPhrase'
);
