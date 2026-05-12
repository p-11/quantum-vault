export const exportRecoveryPhraseSteps = [
  'password-reconfirm',
  'recovery-phrase-reveal'
] as const;

export type ExportRecoveryPhraseStep =
  (typeof exportRecoveryPhraseSteps)[number];

export { flowStepContainerClassName as exportRecoveryPhraseStepContainerClassName } from '@/components/shared/flow-step-layout';
