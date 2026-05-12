import { useEffect, useState } from 'react';

import { useCurrency } from '@/hooks/use-currency';
import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { ensurePresent, isOneOf } from '@/lib/assert';
import {
  vaultDetailCopy,
  vaultDetailInsufficientWithdrawCopyByNamespace,
  vaultDetailUnsupportedAssetWithdrawCopy
} from '@/lib/copy';
import {
  resolveQueryErrorCategory,
  resolveQueryErrorMessage
} from '@/modules/vaults/data/query-error-message';
import {
  VaultDetailBalanceSection,
  VaultDetailHeader,
  VaultDetailStatusBanner
} from '@/modules/vaults/detail/chrome';
import {
  getVaultLabelByLookupKey,
  resolveWithdrawAvailability,
  getVaultTitle,
  type WithdrawAvailability,
  withdrawAvailabilityNamespaces,
  vaultTabs
} from '@/modules/vaults/detail/core';
import {
  VaultDetailActivityPanel,
  VaultDetailFundsPanel
} from '@/modules/vaults/detail/panels';
import type { VaultTabId } from '@/modules/vaults/detail/types';
import { useVaultDetailData } from '@/modules/vaults/detail/use-vault-detail-data';
import { TabsHeader } from '@/modules/vaults/shared/tabs-header';
import { toast } from 'sonner';

import { Screen } from './screen';
import { CenterAbsolutely } from './ui/center-absolutely';
import { MatchQuery } from './ui/match-query';

export const VaultDetailScreen = () => {
  const { navigate } = useScreen();
  const { currency } = useCurrency();
  const { selectedAccount, vault, accounts, sessionId, clearWalletState } =
    useWallet();

  const [activeTabId, setActiveTabId] = useState<VaultTabId>('funds');

  const {
    vaultData,
    vaultDetailQuery,
    isActivityLoading,
    vaultState,
    lifecycleKind,
    lifecycleStatus
  } = useVaultDetailData({
    activeTabId,
    selectedAccount,
    sessionId,
    vault,
    currency,
    onUnexpectedError: error => {
      const errorCategory = resolveQueryErrorCategory(error);
      toast.error(resolveQueryErrorMessage(error));

      if (errorCategory === 'vaultState') {
        clearWalletState();
        navigate('lock', { direction: 'back', type: 'fade' });
        return;
      }

      navigate('home', { direction: 'back' });
    }
  });

  useEffect(() => {
    setActiveTabId('funds');
  }, [selectedAccount?.id]);

  if (!selectedAccount) {
    return null;
  }

  const supportedChains = vault.getSupportedChains();
  const vaultTitle = getVaultTitle({
    selectedAccount,
    accounts,
    supportedChains
  });
  const selectedChain = ensurePresent(
    supportedChains.find(
      chain =>
        chain.chainId.reference === selectedAccount.chainId.reference &&
        chain.chainId.namespace === selectedAccount.chainId.namespace
    ),
    `supported chain for ${selectedAccount.chainId.toString()}`
  );
  const selectedChainName = selectedChain.name;
  const vaultLabelByLookupKey = getVaultLabelByLookupKey({
    accounts,
    supportedChains,
    chainId: selectedAccount.chainId
  });
  const withdrawAvailability: WithdrawAvailability =
    vaultData === undefined
      ? { kind: 'hidden' }
      : (() => {
          if (
            !isOneOf(
              selectedAccount.chainId.namespace,
              withdrawAvailabilityNamespaces
            )
          ) {
            return { kind: 'hidden' };
          }

          return resolveWithdrawAvailability({
            selectedChainNamespace: selectedAccount.chainId.namespace,
            assets: vaultData.assets,
            balances: vaultData.balances,
            disabledMessageByNamespace:
              vaultDetailInsufficientWithdrawCopyByNamespace,
            hasNonInterfaceAssetBalance: vaultData.hasNonInterfaceAssetBalance,
            nonInterfaceAssetMessage: vaultDetailUnsupportedAssetWithdrawCopy
          });
        })();
  const renderVaultDetailPanel = (panelVaultData: typeof vaultData) =>
    activeTabId === 'funds' ? (
      <VaultDetailFundsPanel
        chainName={selectedChainName}
        chainIconUrl={selectedChain.iconUrl}
        vaultTitle={vaultTitle}
        vaultData={panelVaultData}
        vaultState={vaultState}
        lifecycleKind={lifecycleKind}
        lifecycleStatus={lifecycleStatus}
        vaultLabelByLookupKey={vaultLabelByLookupKey}
        selectedChainId={selectedAccount.chainId}
      />
    ) : (
      <VaultDetailActivityPanel
        vaultData={panelVaultData}
        isActivityLoading={isActivityLoading}
        vaultState={vaultState}
        lifecycleStatus={lifecycleStatus}
      />
    );

  return (
    <Screen className='h-(--popup-height) min-h-0 p-0'>
      <VaultDetailHeader
        selectedAddress={selectedAccount.address}
        title={vaultTitle}
        vaultState={vaultState}
        onBack={() => navigate('home', { direction: 'back' })}
      />
      <VaultDetailStatusBanner lifecycleKind={lifecycleKind} />
      <VaultDetailBalanceSection
        vaultData={vaultData}
        vaultState={vaultState}
        lifecycleKind={lifecycleKind}
        currency={currency}
        withdrawAvailability={withdrawAvailability}
        isDataUnavailable={vaultDetailQuery.isError}
        onDeposit={() => navigate('receive')}
        onWithdraw={() => navigate('vault-withdraw')}
      />

      <TabsHeader
        tabs={vaultTabs}
        activeTabId={activeTabId}
        onChange={tabId => setActiveTabId(tabId)}
        className='mx-0 h-14 border-b border-popover px-4'
      />

      <div className='flex flex-1 min-h-0 flex-col overflow-y-auto'>
        <MatchQuery
          value={vaultDetailQuery}
          loading={() => renderVaultDetailPanel(undefined)}
          error={() => (
            <div className='relative min-h-[240px] flex-1'>
              <CenterAbsolutely>
                <p className='type-body-sm text-footer-muted'>
                  {vaultDetailCopy.dataError}
                </p>
              </CenterAbsolutely>
            </div>
          )}
          success={() =>
            renderVaultDetailPanel(ensurePresent(vaultData, 'vault data'))
          }
        />
      </div>
    </Screen>
  );
};
