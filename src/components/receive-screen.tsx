import { useCurrency } from '@/hooks/use-currency';
import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { ensurePresent } from '@/lib/assert';
import { depositFlowCopy } from '@/lib/copy';
import { toastMessages } from '@/lib/content';
import { splitAddressForDepositWrap } from '@/lib/format';
import { match } from '@/lib/match';
import { cn, shortenAddress } from '@/lib/utils';
import type { VaultLifecycleAccount } from '@/modules/vaults/lifecycle/account-read-model';
import { useVaultLifecycleAccounts } from '@/modules/vaults/lifecycle/use-vault-lifecycle-accounts';
import type { PersistedAccount } from '@project-eleven/libqc';
import { ArrowRightIcon, CopyIcon, Loader2Icon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Screen } from './screen';
import { refreshBalancesOnReceiveExit } from './receive-screen-refresh';
import { BackButton } from './ui/back-button';
import { Button } from './ui/button';
import { CenterAbsolutely } from './ui/center-absolutely';
import { MatchQuery } from './ui/match-query';

type PickerView =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'chain-select' }
  | { kind: 'account-select' };

const getUniqueChainAccounts = (
  accounts: ReadonlyArray<VaultLifecycleAccount>
) => {
  const seenChainIds = new Set<string>();

  return accounts.filter(({ account }) => {
    const chainId = account.chainId.toString();
    if (seenChainIds.has(chainId)) {
      return false;
    }

    seenChainIds.add(chainId);
    return true;
  });
};

const isSameAccount = (
  account: PersistedAccount,
  target: PersistedAccount
): boolean => account.id.toString() === target.id.toString();

const includesAccount = (
  accounts: ReadonlyArray<VaultLifecycleAccount>,
  target: PersistedAccount
): boolean => accounts.some(({ account }) => isSameAccount(account, target));

const getPickerView = ({
  isVaultSnapshotLoading,
  isVaultDetailEntryBlocked,
  depositEligibleAccounts,
  activeSelectedChainId,
  chainAccounts
}: {
  isVaultSnapshotLoading: boolean;
  isVaultDetailEntryBlocked: boolean;
  depositEligibleAccounts: ReadonlyArray<VaultLifecycleAccount>;
  activeSelectedChainId: string | null;
  chainAccounts: ReadonlyArray<VaultLifecycleAccount>;
}): PickerView => {
  if (isVaultDetailEntryBlocked) {
    return isVaultSnapshotLoading ? { kind: 'loading' } : { kind: 'empty' };
  }

  if (isVaultSnapshotLoading && depositEligibleAccounts.length === 0) {
    return { kind: 'loading' };
  }

  if (depositEligibleAccounts.length === 0) {
    return { kind: 'empty' };
  }

  if (activeSelectedChainId !== null && chainAccounts.length > 1) {
    return { kind: 'account-select' };
  }

  return { kind: 'chain-select' };
};

const namespaceConfigByNamespace = {
  bip122: {
    tokenFamily: 'BTC',
    networkSubtitle: 'BTC'
  },
  eip155: {
    tokenFamily: 'ETH',
    networkSubtitle: 'ETH'
  }
} as const;

const qrCodeSizePx = 152;
const qrCenterKeepOutSizePx = 69;
const qrCenterKeepOutDataUri =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='69' height='69' viewBox='0 0 69 69'%3E%3Crect width='69' height='69' fill='%2309090b'/%3E%3C/svg%3E";

type SupportedNamespace = keyof typeof namespaceConfigByNamespace;

const isSupportedNamespace = (
  namespace: string
): namespace is SupportedNamespace => namespace in namespaceConfigByNamespace;

const getNamespaceConfig = (namespace: string) => {
  if (!isSupportedNamespace(namespace)) {
    throw new Error(`Unsupported deposit namespace: ${namespace}`);
  }

  return namespaceConfigByNamespace[namespace];
};

const getTokenFamily = (namespace: string) => {
  return getNamespaceConfig(namespace).tokenFamily;
};

const getNetworkSubtitle = (namespace: string): string => {
  return getNamespaceConfig(namespace).networkSubtitle;
};

type ReceivePickerContentProps = {
  pickerView: PickerView;
  uniqueChainAccounts: ReadonlyArray<VaultLifecycleAccount>;
  chainAccounts: ReadonlyArray<VaultLifecycleAccount>;
  supportedChainsByChainId: ReadonlyMap<
    string,
    {
      chainId: {
        namespace: string;
        reference: string;
        toString(): string;
      };
      iconUrl: string;
      name: string;
    }
  >;
  onChainSelect(chainId: string): void;
  onAccountSelect(account: PersistedAccount): void;
};

const ReceivePickerContent = ({
  pickerView,
  uniqueChainAccounts,
  chainAccounts,
  supportedChainsByChainId,
  onChainSelect,
  onAccountSelect
}: ReceivePickerContentProps) =>
  match(pickerView.kind, {
    loading: () => (
      <div
        data-testid='receive-safe-vaults-loading'
        className='mt-8 flex items-center gap-3 text-muted-foreground'
      >
        <Loader2Icon className='size-5 animate-spin' />
        <p className='type-body-sm m-0'>{depositFlowCopy.loadingSafeVaults}</p>
      </div>
    ),
    empty: () => (
      <p
        data-testid='receive-no-safe-vaults'
        className='type-body-sm m-0 mt-8 text-muted-foreground'
      >
        {depositFlowCopy.noSafeVaults}
      </p>
    ),
    'chain-select': () => (
      <div
        data-testid='receive-chain-selection'
        className='mt-8 flex flex-col overflow-y-auto'
      >
        {uniqueChainAccounts.map(({ account }) => {
          const chain = ensurePresent(
            supportedChainsByChainId.get(account.chainId.toString()),
            `deposit chain option for ${account.chainId.toString()}`
          );

          return (
            <button
              key={chain.chainId.toString()}
              type='button'
              data-testid={`receive-chain-${chain.chainId.reference}`}
              className='group flex h-[74px] w-full items-center border border-popover px-4 text-left transition-colors hover:border-border hover:bg-popover/80 focus-visible:border-border focus-visible:bg-popover/80'
              onClick={() => onChainSelect(chain.chainId.toString())}
            >
              <img
                src={chain.iconUrl}
                className='size-12 object-cover'
                alt=''
                aria-hidden='true'
              />
              <div className='ml-3 flex flex-col'>
                <span className='text-base leading-4 text-foreground'>
                  {chain.name}
                </span>
                <span className='mt-2 text-base leading-4 text-footer-muted transition-colors group-hover:text-muted-foreground group-focus-visible:text-muted-foreground'>
                  {getNetworkSubtitle(chain.chainId.namespace)}
                </span>
              </div>
              <ArrowRightIcon className='ml-auto size-6 stroke-[1.5] text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground' />
            </button>
          );
        })}
      </div>
    ),
    'account-select': () => (
      <div
        data-testid='receive-account-selection'
        className='mt-8 flex flex-col gap-2 overflow-y-auto'
      >
        {chainAccounts.map(({ account }) => (
          <Button
            key={account.id.toString()}
            data-testid='receive-account-option'
            data-account-id={account.id.toString()}
            data-address={account.address}
            className='w-full h-auto gap-3 items-center justify-start px-3.5 py-3.5'
            variant='secondary'
            size='sm'
            onClick={() => onAccountSelect(account)}
          >
            <span className='text-sm'>{shortenAddress(account.address)}</span>
          </Button>
        ))}
      </div>
    )
  });

export const ReceiveScreen = () => {
  const { currency } = useCurrency();
  const { navigate, previousScreen } = useScreen();

  const {
    accounts,
    latestWithdrawalRecordByAccountId,
    refreshBalances,
    selectedAccount: walletSelectedAccount,
    sessionId,
    vault
  } = useWallet();
  const supportedChainsByChainId = new Map(
    vault
      .getSupportedChains()
      .map(chain => [chain.chainId.toString(), chain] as const)
  );
  const {
    vaultSnapshotsQuery,
    depositEligibleAccounts,
    getDepositEligibleAccountsByChainId
  } = useVaultLifecycleAccounts({
    accounts,
    vault,
    currency,
    sessionId,
    latestWithdrawalRecordByAccountId
  });
  const isVaultSnapshotLoading = vaultSnapshotsQuery.isPending;

  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [selectedPickerAccount, setSelectedPickerAccount] =
    useState<PersistedAccount | null>(null);

  const copyAddressToClipboard = (account: PersistedAccount) => {
    navigator.clipboard.writeText(account.address);

    toast.success(toastMessages.copiedToClipboard);
  };

  const uniqueChainAccounts = getUniqueChainAccounts(depositEligibleAccounts);

  const selectedChainAccounts =
    selectedChainId !== null
      ? getDepositEligibleAccountsByChainId(selectedChainId)
      : [];
  const activeSelectedChainId =
    selectedChainId !== null && selectedChainAccounts.length > 0
      ? selectedChainId
      : null;
  const chainAccounts =
    activeSelectedChainId !== null ? selectedChainAccounts : [];
  const isVaultDetailEntry = previousScreen === 'vault-detail';

  const handleChainSelect = (chainId: string) => {
    const matching = getDepositEligibleAccountsByChainId(chainId);
    if (matching.length === 1) {
      setSelectedPickerAccount(
        ensurePresent(matching[0], `deposit account for ${chainId}`).account
      );
    } else {
      setSelectedChainId(chainId);
    }
  };

  const eligibleSelectedPickerAccount =
    selectedPickerAccount !== null &&
    includesAccount(depositEligibleAccounts, selectedPickerAccount)
      ? selectedPickerAccount
      : null;
  const soleSelectedChainAccount =
    activeSelectedChainId !== null && chainAccounts.length === 1
      ? ensurePresent(
          chainAccounts[0],
          `deposit account for ${activeSelectedChainId}`
        ).account
      : null;
  const vaultDetailAccount =
    isVaultDetailEntry &&
    walletSelectedAccount !== undefined &&
    includesAccount(depositEligibleAccounts, walletSelectedAccount)
      ? walletSelectedAccount
      : null;
  const isVaultDetailEntryBlocked =
    isVaultDetailEntry && vaultDetailAccount === null;
  const accountToDisplay =
    eligibleSelectedPickerAccount ??
    soleSelectedChainAccount ??
    vaultDetailAccount;
  const pickerView = getPickerView({
    isVaultSnapshotLoading,
    isVaultDetailEntryBlocked,
    depositEligibleAccounts,
    activeSelectedChainId,
    chainAccounts
  });

  const handleBack = () => {
    if (eligibleSelectedPickerAccount) {
      setSelectedPickerAccount(null);
      return;
    }

    if (activeSelectedChainId !== null) {
      setSelectedChainId(null);
      return;
    }

    void refreshBalancesOnReceiveExit({
      refreshBalances,
      onRefreshError: () => {
        toast.error(toastMessages.unexpectedError);
      }
    });
    navigate(previousScreen ?? 'home', { direction: 'back' });
  };

  if (!accountToDisplay) {
    return (
      <Screen>
        <div className='flex flex-1 min-h-0 flex-col justify-between'>
          <div className='min-h-0'>
            <BackButton onClick={handleBack} />

            <div className='mt-3 flex flex-col gap-3'>
              <h1 className='type-heading-lg m-0' data-testid='receive-screen'>
                {depositFlowCopy.selectNetworkTitle}
              </h1>
              <p className='type-body m-0 text-muted-foreground'>
                {depositFlowCopy.selectNetworkSubtitle}
              </p>
            </div>

            <MatchQuery
              value={vaultSnapshotsQuery}
              loading={() => (
                <div
                  data-testid='receive-safe-vaults-loading'
                  className='mt-8 flex items-center gap-3 text-muted-foreground'
                >
                  <Loader2Icon className='size-5 animate-spin' />
                  <p className='type-body-sm m-0'>
                    {depositFlowCopy.loadingSafeVaults}
                  </p>
                </div>
              )}
              error={() => (
                <div className='relative mt-8 min-h-[160px]'>
                  <CenterAbsolutely>
                    <p
                      data-testid='receive-safe-vaults-error'
                      className='type-body-sm m-0 text-footer-muted'
                    >
                      {depositFlowCopy.safeVaultsError}
                    </p>
                  </CenterAbsolutely>
                </div>
              )}
              success={() => (
                <ReceivePickerContent
                  pickerView={pickerView}
                  uniqueChainAccounts={uniqueChainAccounts}
                  chainAccounts={chainAccounts}
                  supportedChainsByChainId={supportedChainsByChainId}
                  onChainSelect={handleChainSelect}
                  onAccountSelect={setSelectedPickerAccount}
                />
              )}
            />
          </div>

          {pickerView.kind === 'chain-select' && (
            <div className='border border-white/10 bg-popover px-2.5 py-2'>
              <p className='type-body-sm m-0 text-muted-foreground'>
                {depositFlowCopy.selectNetworkWarning}
              </p>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  const accountChain = ensurePresent(
    supportedChainsByChainId.get(accountToDisplay.chainId.toString()),
    `deposit chain for ${accountToDisplay.chainId.toString()}`
  );

  const chainSymbol = accountChain.nativeCurrency.symbol;
  const tokenFamily = getTokenFamily(accountToDisplay.chainId.namespace);
  const vaultTitle = `${chainSymbol} Vault`;
  const isEip155DepositAddress =
    accountToDisplay.chainId.namespace === 'eip155';
  const eip155DepositAddressParts = isEip155DepositAddress
    ? splitAddressForDepositWrap({ address: accountToDisplay.address })
    : null;

  return (
    <Screen>
      <div className='flex flex-1 min-h-0 flex-col justify-between'>
        <div data-testid='receive-address-view'>
          <BackButton onClick={handleBack} />

          <div className='mt-3 flex flex-col gap-3'>
            <h1 className='type-heading-lg m-0' data-testid='receive-screen'>
              {vaultTitle}
            </h1>
            <p className='type-body m-0 max-w-[296px] text-warning'>
              {depositFlowCopy.warningSubtitle(chainSymbol, tokenFamily)}
            </p>
          </div>

          <div className='mt-8 flex justify-center'>
            <div
              className='flex h-[177px] w-[182px] items-center justify-center border border-popover'
              data-testid='receive-qr-code'
            >
              <div className='relative'>
                <QRCodeSVG
                  value={accountToDisplay.address}
                  size={qrCodeSizePx}
                  level='H'
                  imageSettings={{
                    src: qrCenterKeepOutDataUri,
                    width: qrCenterKeepOutSizePx,
                    height: qrCenterKeepOutSizePx,
                    excavate: true
                  }}
                />
                <div className='absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center'>
                  <img
                    src={accountChain.iconUrl}
                    className='size-[29px]'
                    alt=''
                    aria-hidden='true'
                  />
                </div>
              </div>
            </div>
          </div>

          <div className='mt-8 flex flex-col gap-[7px]'>
            <p className='type-footnote m-0'>
              {depositFlowCopy.vaultAddressLabel}
            </p>
            <div
              className={cn(
                'flex gap-1 border border-popover pl-2 pr-1',
                isEip155DepositAddress
                  ? 'min-h-11 items-start py-2'
                  : 'h-11 items-center'
              )}
            >
              <p
                data-testid='receive-selected-address'
                data-address={accountToDisplay.address}
                className={cn(
                  'type-footnote m-0 min-w-0 flex-1 text-left',
                  isEip155DepositAddress
                    ? 'break-all whitespace-normal'
                    : 'overflow-hidden text-ellipsis whitespace-nowrap'
                )}
              >
                {isEip155DepositAddress && eip155DepositAddressParts ? (
                  <>
                    {eip155DepositAddressParts.head}
                    {eip155DepositAddressParts.tail ? (
                      <span className='whitespace-nowrap'>
                        {eip155DepositAddressParts.tail}
                      </span>
                    ) : null}
                  </>
                ) : (
                  accountToDisplay.address
                )}
              </p>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label={depositFlowCopy.copyAddressAria}
                data-testid='receive-inline-copy-address-button'
                className={cn(
                  'size-7 shrink-0 rounded-none text-muted-foreground hover:bg-popover/80 hover:text-foreground',
                  isEip155DepositAddress ? 'mt-0.5 self-start' : ''
                )}
                onClick={() => copyAddressToClipboard(accountToDisplay)}
              >
                <CopyIcon className='size-4' />
              </Button>
            </div>
          </div>
        </div>

        <Button
          data-testid='receive-copy-address-button'
          className='type-label rounded-none'
          size='flow'
          onClick={() => copyAddressToClipboard(accountToDisplay)}
        >
          {depositFlowCopy.copyAddressAction}
        </Button>
      </div>
    </Screen>
  );
};
