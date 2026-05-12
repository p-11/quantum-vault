import { AccountScreen } from './components/account-screen';
import { HomeScreen } from './components/home-screen';
import { InitialScreen } from './components/initial-screen';
import { LockScreen } from './components/lock-screen';
import { OnboardingScreen } from './components/onboarding-screen';
import { ReceiveScreen } from './components/receive-screen';
import { SettingsCurrencyScreen } from './components/settings/settings-currency-screen';
import { SettingsDeleteWalletScreen } from './components/settings/settings-delete-wallet-screen';
import { SettingsLockWalletScreen } from './components/settings/settings-lock-wallet-screen';
import { SettingsScreen } from './components/settings/settings-screen';
import { VaultWithdrawScreen } from './components/vault-withdraw-screen';
import { VaultDetailScreen } from './components/vault-detail-screen';
import { WalletCreationScreen } from './components/wallet-creation/wallet-creation-screen';
import { WalletRecoveryScreen } from './components/wallet-recovery/wallet-recovery-screen';
import { ExportRecoveryPhraseScreen } from './components/export-recovery-phrase/export-recovery-phrase-screen';

export const screens = {
  initial: <InitialScreen />,
  'wallet-creation': <WalletCreationScreen />,
  'wallet-recovery': <WalletRecoveryScreen />,
  onboarding: <OnboardingScreen />,
  home: <HomeScreen />,
  settings: <SettingsScreen />,
  'settings-currency': <SettingsCurrencyScreen />,
  'settings-lock-wallet': <SettingsLockWalletScreen />,
  'settings-delete-wallet': <SettingsDeleteWalletScreen />,
  'export-recovery-phrase': <ExportRecoveryPhraseScreen />,
  account: <AccountScreen />,
  'vault-detail': <VaultDetailScreen />,
  'vault-withdraw': <VaultWithdrawScreen />,
  receive: <ReceiveScreen />,
  lock: <LockScreen />
};

export type ScreenKey = keyof typeof screens;
