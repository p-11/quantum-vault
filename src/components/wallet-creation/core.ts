export const walletCreationSteps = [
  'password',
  'backup-prompt',
  'seed-reveal',
  'verify-prompt',
  'word-verification',
  'success'
] as const;

export type WalletCreationStep = (typeof walletCreationSteps)[number];

export { flowStepContainerClassName as walletCreationStepContainerClassName } from '@/components/shared/flow-step-layout';
