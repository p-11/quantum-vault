import { useState } from 'react';
import { toast } from 'sonner';

import { useCurrency } from '@/hooks/use-currency';
import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { attempt } from '@/lib/attempt';
import { toastMessages } from '@/lib/content';
import { match } from '@/lib/match';

import type { SettingsRowConfig } from './core';
import {
  SettingsCurrencyIcon,
  SettingsDeleteWalletIcon,
  SettingsExportKeysIcon,
  SettingsLockIcon,
  SettingsSyncIcon
} from './icons';
import { SettingsPage } from './settings-page';
import { SettingsRow } from './settings-row';

export const SettingsScreen = () => {
  const { navigate } = useScreen();
  const { currency } = useCurrency();
  const { initWallet } = useWallet();
  const [isSyncingWallet, setIsSyncingWallet] = useState(false);

  const handleSyncWallet = async () => {
    if (isSyncingWallet) {
      return;
    }

    setIsSyncingWallet(true);
    const syncResult = await attempt(() =>
      initWallet({ validateBalanceProvider: true })
    );
    setIsSyncingWallet(false);

    if ('error' in syncResult) {
      toast.error(toastMessages.walletSyncFailed);
      return;
    }

    match(syncResult.data, {
      degraded: () => toast.error(toastMessages.walletSyncFailed),
      ignored: () => undefined,
      ready: () => toast.success(toastMessages.walletSyncSuccess)
    });
  };

  const rows: ReadonlyArray<SettingsRowConfig> = [
    {
      id: 'sync-wallet',
      label: isSyncingWallet ? 'SYNCING...' : 'SYNC WALLET',
      icon: SettingsSyncIcon,
      isLoading: isSyncingWallet,
      disabled: isSyncingWallet,
      testId: 'sync-wallet-button',
      onSelect: () => void handleSyncWallet()
    },
    {
      id: 'change-currency',
      label: 'CHANGE CURRENCY',
      icon: SettingsCurrencyIcon,
      value: currency.toUpperCase(),
      testId: 'change-currency-button',
      onSelect: () => navigate('settings-currency')
    },
    {
      id: 'lock-wallet',
      label: 'LOCK WALLET',
      icon: SettingsLockIcon,
      testId: 'lock-wallet-button',
      onSelect: () => navigate('settings-lock-wallet')
    },
    {
      id: 'export-keys',
      label: 'EXPORT KEYS',
      icon: SettingsExportKeysIcon,
      testId: 'export-keys-button',
      onSelect: () => navigate('export-recovery-phrase')
    },
    {
      id: 'delete-quantum-vault',
      label: 'DELETE QUANTUM VAULT',
      icon: SettingsDeleteWalletIcon,
      tone: 'destructive',
      testId: 'delete-quantum-vault-button',
      onSelect: () => navigate('settings-delete-wallet')
    }
  ];

  return (
    <SettingsPage
      title='Settings'
      onBack={() => navigate('home', { direction: 'back' })}
    >
      <div className='mt-4'>
        <div className='border-b border-divider' />

        <p className='mt-2 px-4 text-xs font-normal uppercase leading-4 text-muted-foreground'>
          GENERAL
        </p>

        <div>
          {rows.map(row => (
            <div
              key={row.id}
              className='border-b border-divider last:border-b-0'
            >
              <SettingsRow {...row} />
            </div>
          ))}
        </div>
      </div>
    </SettingsPage>
  );
};
