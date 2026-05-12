import type { Mnemonic } from '@project-eleven/libqc';

export type WalletCreationFlowState = {
  password: string;
  passwordConfirmation: string;
  mnemonic: Mnemonic | undefined;
  isSettingPassword: boolean;
  isCreatingWallet: boolean;
};
