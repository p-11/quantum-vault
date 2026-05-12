import { useCurrency } from '@/hooks/use-currency';
import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { ensurePresent } from '@/lib/assert';
import { attempt } from '@/lib/attempt';
import { getVaultName, withdrawFlowCopy } from '@/lib/copy';
import { match } from '@/lib/match';
import { convertDuration } from '@/lib/time';
import { formatAssetBalance } from '@/lib/utils';
import {
  NonInterfaceAssetBalanceError,
  loadVaultWithdrawSummary,
  type SummaryItem,
  type SummaryState
} from '@/lib/vault-operations';
import {
  buildAccountChainByReference,
  getVaultNumberByAccountId
} from '@/modules/vaults/data/mappers/vault';
import type { VaultLifecycleAccount } from '@/modules/vaults/lifecycle/account-read-model';
import { useVaultLifecycleAccounts } from '@/modules/vaults/lifecycle/use-vault-lifecycle-accounts';
import { shortenVaultAddress } from '@/modules/vaults/shared/address';
import { WarningCircleIcon } from '@/modules/vaults/shared/icons';
import { resolveAssetIconUrl } from '@/modules/vaults/shared/asset-icon';
import { StatusBadge } from '@/modules/vaults/shared/status-badge';
import type { ScreenKey } from '@/screens';
import {
  InsufficientNativeBalanceForGasError,
  InvalidDestinationAddressError,
  NoWithdrawableAssetsError,
  VaultCorruptedError,
  isAddress,
  isBitcoinChain,
  type PersistedAccount
} from '@project-eleven/libqc';
import { AnimatePresence } from 'framer-motion';
import { Loader2Icon, XCircleIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AnimateScreen, type AnimateScreenOptions } from './animate-screen';
import { Screen } from './screen';
import { BackButton } from './ui/back-button';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';

type WithdrawStep =
  | 'warning'
  | 'suggestion'
  | 'entry-loading'
  | 'add-address'
  | 'review'
  | 'loading'
  | 'error';

type ReviewSource = 'manual' | 'suggested-safe';

type AssetListProps = {
  chainIconUrl: string;
  summaryState: SummaryState;
};

const AssetList = ({ chainIconUrl, summaryState }: AssetListProps) => {
  if (summaryState.status === 'ready') {
    return (
      <div className='border border-popover'>
        {summaryState.items.map(({ asset, balance }: SummaryItem) => (
          <div
            key={asset.id}
            className='flex items-center justify-between gap-2 px-4 py-3'
          >
            <div className='flex min-w-0 items-center gap-3'>
              <img
                src={resolveAssetIconUrl({
                  asset,
                  chainIconUrl
                })}
                className='size-6 shrink-0 rounded-full'
                alt={`${asset.name} icon`}
              />
              <div className='flex min-w-0 flex-col gap-2'>
                <span className='text-sm leading-none'>
                  {formatAssetBalance(balance.balance, asset)}
                </span>
                <span className='text-sm leading-none text-footer-muted'>
                  {asset.name}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return match(summaryState.status, {
    loading: () => (
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-14 w-full' />
        <Skeleton className='h-14 w-full' />
      </div>
    ),
    error: () => (
      <p className='type-body-sm text-destructive'>
        Unable to load assets. Please go back and try again.
      </p>
    ),
    empty: () => (
      <p className='type-body-sm text-muted-foreground'>
        No assets with balance to withdraw.
      </p>
    ),
    'unsupported-assets': () => (
      <p className='type-body-sm text-destructive'>
        Unsupported token balances cannot be withdrawn in this version.
      </p>
    ),
    idle: () => null
  });
};

type ReviewStepProps = {
  chainIconUrl: string;
  chainName: string;
  confirmLabel: string;
  destinationAddress: string;
  reviewSource: ReviewSource;
  suggestedVaultLabel: string | null;
  summaryState: SummaryState;
  onCancel(): void;
  onConfirm(): void;
};

const ReviewStep = ({
  chainIconUrl,
  chainName,
  confirmLabel,
  destinationAddress,
  reviewSource,
  suggestedVaultLabel,
  summaryState,
  onCancel,
  onConfirm
}: ReviewStepProps) => {
  const canConfirm = summaryState.status === 'ready';
  const estimatedFee =
    summaryState.status === 'ready' ? summaryState.estimatedFee : null;

  return (
    <div
      data-testid='withdraw-review-step'
      className='mt-7 flex flex-1 min-h-0 flex-col justify-between'
    >
      <div>
        <h1 className='type-heading-lg m-0'>{withdrawFlowCopy.reviewTitle}</h1>

        <div className='mt-6 flex flex-col gap-2'>
          <p className='type-footnote m-0 text-footer-muted'>
            Assets to withdraw
          </p>
          <AssetList chainIconUrl={chainIconUrl} summaryState={summaryState} />
        </div>

        <div className='mt-5 flex items-center gap-2'>
          <span className='h-px flex-1 bg-popover' />
          <p className='type-footnote m-0 text-footer-muted'>
            {withdrawFlowCopy.reviewToLegend}
          </p>
          <span className='h-px flex-1 bg-popover' />
        </div>

        <div className='mt-4 border border-popover px-4 py-3'>
          <p className='type-footnote m-0 text-footer-muted'>
            {withdrawFlowCopy.reviewAddressLabel(chainName)}
          </p>
          <p className='m-0 mt-2 break-all text-sm leading-none'>
            {reviewSource === 'suggested-safe'
              ? shortenVaultAddress(destinationAddress)
              : destinationAddress}
          </p>
          {reviewSource === 'suggested-safe' && suggestedVaultLabel ? (
            <div className='mt-3 flex items-center gap-2 border-t border-popover pt-3'>
              <p className='type-footnote m-0 text-footer-muted'>
                {suggestedVaultLabel}
              </p>
              <StatusBadge kind='safe' />
            </div>
          ) : null}
        </div>

        <div className='mt-4 flex items-center justify-between'>
          <p className='type-footnote m-0'>{withdrawFlowCopy.reviewFeeLabel}</p>
          {summaryState.status === 'loading' ? (
            <Skeleton className='h-4 w-24' />
          ) : (
            <p className='type-footnote m-0'>
              {estimatedFee ?? 'Unable to estimate'}
            </p>
          )}
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <Button
          data-testid='confirm-withdraw-button'
          size='flow'
          className='rounded-none'
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button
          data-testid='withdraw-review-cancel-button'
          size='flow'
          variant='secondary'
          className='rounded-none'
          onClick={onCancel}
        >
          {withdrawFlowCopy.cancelAction}
        </Button>
      </div>
    </div>
  );
};

type WarningStepProps = {
  onBack(): void;
  onContinue(): void;
};

const WarningStep = ({ onBack, onContinue }: WarningStepProps) => (
  <div className='mt-7 flex flex-1 min-h-0 flex-col justify-between'>
    <div>
      <h1 className='type-heading-lg m-0 text-warning'>
        {withdrawFlowCopy.warningTitle}
      </h1>

      <p className='type-body m-0 mt-8 whitespace-pre-line text-foreground'>
        {withdrawFlowCopy.warningBody}
      </p>
    </div>

    <div className='flex flex-col gap-3'>
      <Button
        data-testid='continue-button'
        data-step='warning'
        size='flow'
        className='rounded-none'
        onClick={onContinue}
      >
        {withdrawFlowCopy.continueAction}
      </Button>
      <Button
        data-testid='withdraw-warning-back-button'
        size='flow'
        variant='secondary'
        className='rounded-none'
        onClick={onBack}
      >
        {withdrawFlowCopy.backAction}
      </Button>
    </div>
  </div>
);

type SuggestionStepProps = {
  suggestedVaultLabel: string;
  onNo(): void;
  onYes(): void;
};

const FullBalanceWithdrawHelper = () => (
  <div
    data-testid='withdraw-full-balance-helper'
    className='mt-6 flex items-start gap-2 border border-popover bg-popover px-3 py-3'
  >
    <WarningCircleIcon className='mt-0.5 text-muted-foreground' aria-hidden />
    <p className='type-body-sm m-0 min-w-0 flex-1 text-muted-foreground'>
      {withdrawFlowCopy.fullBalanceWithdrawHelper}
    </p>
  </div>
);

const SuggestionStep = ({
  suggestedVaultLabel,
  onNo,
  onYes
}: SuggestionStepProps) => (
  <div className='mt-7 flex flex-1 min-h-0 flex-col justify-between'>
    <div>
      <h1 className='type-heading-lg m-0'>{withdrawFlowCopy.warningTitle}</h1>

      <p className='type-body m-0 mt-8 whitespace-pre-line text-foreground'>
        {withdrawFlowCopy.suggestionBody(suggestedVaultLabel)}
      </p>

      <FullBalanceWithdrawHelper />
    </div>

    <div className='flex flex-col gap-3'>
      <Button
        data-testid='withdraw-suggestion-yes-button'
        size='flow'
        className='rounded-none'
        onClick={onYes}
      >
        {withdrawFlowCopy.suggestionYes}
      </Button>
      <Button
        data-testid='withdraw-suggestion-no-button'
        size='flow'
        variant='secondary'
        className='rounded-none'
        onClick={onNo}
      >
        {withdrawFlowCopy.suggestionNo}
      </Button>
    </div>
  </div>
);

type AddAddressStepProps = {
  chainName: string;
  destinationAddress: string;
  isBitcoin: boolean;
  addressError: string | null;
  helperError: string | null;
  onAddressChange(value: string): void;
  onCancel(): void;
  onContinue(): void;
};

const AddAddressStep = ({
  chainName,
  destinationAddress,
  isBitcoin,
  addressError,
  helperError,
  onAddressChange,
  onCancel,
  onContinue
}: AddAddressStepProps) => (
  <div
    data-testid='withdraw-add-address-step'
    className='mt-7 flex flex-1 min-h-0 flex-col justify-between'
  >
    <div>
      <h1 className='type-heading-lg m-0'>
        {withdrawFlowCopy.addAddressTitle}
      </h1>

      <label htmlFor='destination-address' className='mt-[18px] type-label'>
        {withdrawFlowCopy.addAddressFieldLabel(chainName)}
      </label>

      <Input
        id='destination-address'
        data-testid='destination-address-input'
        placeholder={
          isBitcoin ? 'bc1...' : withdrawFlowCopy.addAddressPlaceholder
        }
        value={destinationAddress}
        onChange={event => onAddressChange(event.target.value)}
        aria-invalid={addressError !== null}
        className='mt-3 h-11 bg-muted px-4 type-body-sm'
      />

      {addressError ? (
        <p className='type-body-sm m-0 mt-2 text-destructive'>{addressError}</p>
      ) : null}

      {helperError ? (
        <p
          data-testid='withdraw-safe-destination-error'
          className='type-body-sm m-0 mt-3 text-footer-muted'
        >
          {helperError}
        </p>
      ) : null}

      <FullBalanceWithdrawHelper />
    </div>

    <div className='flex flex-col gap-3'>
      <Button
        data-testid='continue-button'
        data-step='destination'
        size='flow'
        className='rounded-none'
        disabled={destinationAddress.trim().length === 0}
        onClick={onContinue}
      >
        {withdrawFlowCopy.continueAction}
      </Button>
      <Button
        data-testid='withdraw-add-address-cancel-button'
        size='flow'
        variant='secondary'
        className='rounded-none'
        onClick={onCancel}
      >
        {withdrawFlowCopy.cancelAction}
      </Button>
    </div>
  </div>
);

type LoadingStepProps = {
  destinationAddress: string;
};

const EntrypointLoadingStep = () => (
  <div className='mt-6 flex flex-1 min-h-0 flex-col items-center justify-center gap-4 py-12'>
    <Loader2Icon className='size-8 animate-spin text-muted-foreground' />
    <p className='text-sm text-muted-foreground'>
      Loading withdrawal options...
    </p>
  </div>
);

const LoadingStep = ({ destinationAddress }: LoadingStepProps) => (
  <div className='mt-6 flex flex-col items-center gap-4 py-12'>
    <Loader2Icon className='size-8 animate-spin text-muted-foreground' />
    <p className='text-muted-foreground'>
      Withdrawing funds to {shortenVaultAddress(destinationAddress)}...
    </p>
    <p className='text-sm text-muted-foreground'>
      Please wait while your transactions are being processed.
    </p>
  </div>
);

type ErrorStepProps = {
  error: string | null;
  onBackToVault(): void;
  onTryAgain(): void;
};

const ErrorStep = ({ error, onBackToVault, onTryAgain }: ErrorStepProps) => (
  <div className='mt-6 flex flex-col items-center gap-4 py-12'>
    <XCircleIcon className='size-8 text-destructive' />
    <p className='text-lg font-medium'>Withdrawal Failed</p>
    <p className='text-center text-sm text-destructive'>{error}</p>
    <div className='mt-4 flex w-full gap-3'>
      <Button
        data-testid='withdraw-error-back-to-vault-button'
        variant='outline'
        className='flex-1'
        onClick={onBackToVault}
      >
        Back to Vault
      </Button>
      <Button className='flex-1' onClick={onTryAgain}>
        Try Again
      </Button>
    </div>
  </div>
);

const mapWithdrawError = (error: unknown): string => {
  if (error instanceof NoWithdrawableAssetsError) {
    return 'This vault has no assets available to withdraw.';
  }
  if (error instanceof InvalidDestinationAddressError) {
    return 'The destination address is invalid. Please go back and check the address.';
  }
  if (error instanceof VaultCorruptedError) {
    return 'The vault data appears to be corrupted. Please contact support.';
  }
  if (error instanceof InsufficientNativeBalanceForGasError) {
    return 'There is not enough balance to cover the transaction fees.';
  }
  if (error instanceof NonInterfaceAssetBalanceError) {
    return 'Unsupported token balances cannot be withdrawn in this version.';
  }

  return 'An unexpected error occurred.';
};

const suggestionResolutionTimeoutMs = convertDuration(10, 's', 'ms');

const getInitialStep = ({
  previousScreen
}: {
  previousScreen: ScreenKey | null;
}): WithdrawStep => {
  if (previousScreen !== 'vault-detail') {
    return 'warning';
  }

  return 'entry-loading';
};

const addressValidationByNamespace = {
  bip122: {
    getError: () => null
  },
  eip155: {
    getError: (destination: string) =>
      isAddress(destination) ? null : 'Please enter a valid EVM address.'
  }
} as const;

type SupportedWithdrawNamespace = keyof typeof addressValidationByNamespace;

const isSupportedWithdrawNamespace = (
  namespace: string
): namespace is SupportedWithdrawNamespace =>
  namespace in addressValidationByNamespace;

const getAddressValidationError = ({
  destination,
  namespace
}: {
  destination: string;
  namespace: string;
}): string | null => {
  if (!isSupportedWithdrawNamespace(namespace)) {
    throw new Error(`Unsupported withdraw namespace: ${namespace}`);
  }

  return addressValidationByNamespace[namespace].getError(destination);
};

type SuggestedSafeDestination = {
  address: string;
  vaultLabel: string;
};

type AccountChainByReference = ReturnType<typeof buildAccountChainByReference>;

const resolveSuggestedSafeDestination = ({
  accountChainByReference,
  safeDestinationCandidates,
  vaultNumberByAccountId
}: {
  accountChainByReference: AccountChainByReference;
  safeDestinationCandidates: ReadonlyArray<VaultLifecycleAccount>;
  vaultNumberByAccountId: Record<string, number>;
}): SuggestedSafeDestination | null => {
  const safeCandidate = safeDestinationCandidates[0];
  if (!safeCandidate) {
    return null;
  }

  const { account } = safeCandidate;
  const chainMetadata = ensurePresent(
    accountChainByReference[account.chainId.reference],
    `chain metadata for ${account.chainId.reference}`
  );
  const vaultNumber = ensurePresent(
    vaultNumberByAccountId[safeCandidate.accountId],
    `vault number for account ${safeCandidate.accountId}`
  );

  return {
    address: account.address,
    vaultLabel: getVaultName({
      chainName: chainMetadata.name,
      vaultNumber
    })
  };
};

export const VaultWithdrawScreen = () => {
  const { currency } = useCurrency();
  const { navigate, previousScreen } = useScreen();
  const {
    accounts,
    latestWithdrawalRecordByAccountId,
    selectedAccount,
    sessionId,
    vault,
    withdrawVaultFunds
  } = useWallet();
  const [entryPreviousScreen] = useState(previousScreen);
  const enteredFromVaultDetail = entryPreviousScreen === 'vault-detail';
  const shouldResolveSuggestion = enteredFromVaultDetail;

  const [activeStep, setActiveStep] = useState<WithdrawStep>(() =>
    getInitialStep({
      previousScreen: entryPreviousScreen
    })
  );
  const [reviewSource, setReviewSource] = useState<ReviewSource>('manual');
  const [animateScreenOptions, setAnimateScreenOptions] =
    useState<AnimateScreenOptions>({
      direction: 'forward',
      type: 'slide'
    });

  const [manualDestinationAddress, setManualDestinationAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [summaryState, setSummaryState] = useState<SummaryState>({
    status: 'idle'
  });

  const summaryRequestIdRef = useRef(0);
  const accountChainByReference = buildAccountChainByReference(
    vault.getSupportedChains()
  );
  const vaultNumberByAccountId = getVaultNumberByAccountId(accounts);
  const suggestionAccounts: ReadonlyArray<PersistedAccount> =
    shouldResolveSuggestion ? accounts : [];
  const { vaultSnapshotsQuery, getSafeDestinationCandidatesFor } =
    useVaultLifecycleAccounts({
      accounts: suggestionAccounts,
      vault,
      currency,
      sessionId,
      latestWithdrawalRecordByAccountId
    });
  const isVaultSnapshotLoading = vaultSnapshotsQuery.isPending;
  const isVaultSnapshotError = vaultSnapshotsQuery.isError;
  const safeDestinationCandidates =
    selectedAccount === undefined
      ? []
      : getSafeDestinationCandidatesFor(selectedAccount);
  const selectedChain = selectedAccount
    ? ensurePresent(
        vault
          .getSupportedChains()
          .find(
            chain =>
              chain.chainId.toString() === selectedAccount.chainId.toString()
          ),
        `chain metadata for ${selectedAccount.chainId.toString()}`
      )
    : null;
  const isBitcoin = selectedAccount
    ? isBitcoinChain(selectedAccount.chainId)
    : false;
  const suggestedSafeDestination = resolveSuggestedSafeDestination({
    accountChainByReference,
    safeDestinationCandidates,
    vaultNumberByAccountId
  });
  const suggestedSafeDestinationAddress =
    suggestedSafeDestination?.address ?? null;
  const trimmedDestinationAddress = destinationAddress.trim();

  useEffect(() => {
    if (!shouldResolveSuggestion || activeStep !== 'entry-loading') {
      return;
    }

    if (isVaultSnapshotError) {
      setActiveStep('add-address');
      return;
    }

    if (!isVaultSnapshotLoading) {
      setActiveStep(
        suggestedSafeDestinationAddress !== null ? 'suggestion' : 'add-address'
      );
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveStep(currentStep =>
        currentStep === 'entry-loading' ? 'add-address' : currentStep
      );
    }, suggestionResolutionTimeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeStep,
    isVaultSnapshotError,
    isVaultSnapshotLoading,
    shouldResolveSuggestion,
    suggestedSafeDestinationAddress
  ]);

  if (!selectedAccount || !selectedChain) {
    return null;
  }

  const goToStep = (
    step: WithdrawStep,
    direction: AnimateScreenOptions['direction'] = 'forward'
  ) => {
    setAnimateScreenOptions({ direction, type: 'slide' });
    setActiveStep(step);
  };

  const resetReviewState = () => {
    summaryRequestIdRef.current += 1;
    setSummaryState({ status: 'idle' });
  };

  const loadReviewSummary = async (destination: string) => {
    const requestId = ++summaryRequestIdRef.current;
    setSummaryState({ status: 'loading' });

    const result = await attempt(() =>
      loadVaultWithdrawSummary(vault, selectedAccount, destination)
    );

    if (summaryRequestIdRef.current !== requestId) {
      return;
    }

    setSummaryState('error' in result ? { status: 'error' } : result.data);
  };

  const handleContinueFromAddAddress = () => {
    const trimmedManualDestination = manualDestinationAddress.trim();

    if (trimmedManualDestination.length === 0) {
      setAddressError('Please enter a destination address.');
      return;
    }

    const validationError = getAddressValidationError({
      destination: trimmedManualDestination,
      namespace: selectedAccount.chainId.namespace
    });
    if (validationError) {
      setAddressError(validationError);
      return;
    }

    setDestinationAddress(trimmedManualDestination);
    setReviewSource('manual');
    setAddressError(null);
    goToStep('review');
    void loadReviewSummary(trimmedManualDestination);
  };

  const handleContinueFromWarning = () => {
    if (suggestedSafeDestination) {
      goToStep('suggestion');
      return;
    }

    goToStep('add-address');
  };

  const handleSelectSuggestedDestination = () => {
    const destination = ensurePresent(
      suggestedSafeDestination,
      'safe vault destination suggestion'
    );
    setDestinationAddress(destination.address);
    setReviewSource('suggested-safe');
    setAddressError(null);
    goToStep('review');
    void loadReviewSummary(destination.address);
  };

  const handleDeclineSuggestedDestination = () => {
    setReviewSource('manual');
    setAddressError(null);
    goToStep('add-address');
  };

  const getAddAddressBackStep = (): WithdrawStep | null => {
    if (suggestedSafeDestination) {
      return 'suggestion';
    }

    return enteredFromVaultDetail ? null : 'warning';
  };

  const getReviewBackStep = (): WithdrawStep =>
    match<ReviewSource, WithdrawStep>(reviewSource, {
      manual: () => 'add-address',
      'suggested-safe': () => 'suggestion'
    });

  const handleBackFromReview = () => {
    resetReviewState();
    goToStep(getReviewBackStep(), 'back');
  };

  const handleConfirmWithdraw = async () => {
    goToStep('loading');

    const result = await attempt(() =>
      withdrawVaultFunds(trimmedDestinationAddress)
    );

    if ('error' in result) {
      setWithdrawError(mapWithdrawError(result.error));
      goToStep('error');
      return;
    }

    navigate('vault-detail', { direction: 'forward' });
  };

  const exitWithdrawFlow = () => {
    navigate(enteredFromVaultDetail ? 'vault-detail' : 'home', {
      direction: 'back'
    });
  };

  const handleTopBack = () =>
    match(activeStep, {
      warning: exitWithdrawFlow,
      suggestion: () => {
        if (enteredFromVaultDetail) {
          exitWithdrawFlow();
          return;
        }

        goToStep('warning', 'back');
      },
      'add-address': () => {
        const backStep = getAddAddressBackStep();
        if (backStep === null) {
          exitWithdrawFlow();
          return;
        }

        goToStep(backStep, 'back');
      },
      'entry-loading': exitWithdrawFlow,
      review: handleBackFromReview,
      loading: () => null,
      error: () => {
        setWithdrawError(null);
        goToStep('review', 'back');
      }
    });

  const confirmLabel = match(reviewSource, {
    manual: () => withdrawFlowCopy.confirmWithdrawalAction,
    'suggested-safe': () => withdrawFlowCopy.confirmAction
  });

  return (
    <Screen>
      <BackButton
        testId='withdraw-back-button'
        disabled={activeStep === 'loading'}
        label='Back'
        onClick={handleTopBack}
      />

      <div className='flex flex-1 min-h-0 flex-col overflow-hidden'>
        <AnimatePresence mode='wait' custom={animateScreenOptions}>
          {match(activeStep, {
            warning: () => (
              <AnimateScreen
                key='warning'
                custom={animateScreenOptions}
                className='flex flex-1 min-h-0 flex-col'
              >
                <div
                  data-testid='withdraw-step-warning'
                  className='flex flex-1 min-h-0 flex-col'
                >
                  <WarningStep
                    onBack={exitWithdrawFlow}
                    onContinue={handleContinueFromWarning}
                  />
                </div>
              </AnimateScreen>
            ),
            suggestion: () => (
              <AnimateScreen
                key='suggestion'
                custom={animateScreenOptions}
                className='flex flex-1 min-h-0 flex-col'
              >
                <div
                  data-testid='withdraw-suggestion-step'
                  className='flex flex-1 min-h-0 flex-col'
                >
                  <SuggestionStep
                    suggestedVaultLabel={
                      ensurePresent(
                        suggestedSafeDestination,
                        'safe vault destination suggestion'
                      ).vaultLabel
                    }
                    onNo={handleDeclineSuggestedDestination}
                    onYes={handleSelectSuggestedDestination}
                  />
                </div>
              </AnimateScreen>
            ),
            'entry-loading': () => (
              <AnimateScreen
                key='entry-loading'
                custom={animateScreenOptions}
                className='flex flex-1 min-h-0 flex-col'
              >
                <div
                  data-testid='withdraw-step-entry-loading'
                  className='flex flex-1 min-h-0 flex-col'
                >
                  <EntrypointLoadingStep />
                </div>
              </AnimateScreen>
            ),
            'add-address': () => (
              <AnimateScreen
                key='add-address'
                custom={animateScreenOptions}
                className='flex flex-1 min-h-0 flex-col'
              >
                <div
                  data-testid='withdraw-step-destination'
                  className='flex flex-1 min-h-0 flex-col'
                >
                  <AddAddressStep
                    chainName={selectedChain.name}
                    destinationAddress={manualDestinationAddress}
                    isBitcoin={isBitcoin}
                    addressError={addressError}
                    helperError={
                      isVaultSnapshotError
                        ? withdrawFlowCopy.safeDestinationLookupError
                        : null
                    }
                    onAddressChange={value => {
                      setManualDestinationAddress(value);
                      if (addressError !== null) {
                        setAddressError(null);
                      }
                    }}
                    onCancel={exitWithdrawFlow}
                    onContinue={handleContinueFromAddAddress}
                  />
                </div>
              </AnimateScreen>
            ),
            review: () => (
              <AnimateScreen
                key='review'
                custom={animateScreenOptions}
                className='flex flex-1 min-h-0 flex-col'
              >
                <div
                  data-testid='withdraw-step-review'
                  className='flex flex-1 min-h-0 flex-col'
                >
                  <ReviewStep
                    chainIconUrl={selectedChain.iconUrl}
                    chainName={selectedChain.name}
                    confirmLabel={confirmLabel}
                    destinationAddress={trimmedDestinationAddress}
                    reviewSource={reviewSource}
                    suggestedVaultLabel={
                      suggestedSafeDestination?.vaultLabel ?? null
                    }
                    summaryState={summaryState}
                    onCancel={exitWithdrawFlow}
                    onConfirm={handleConfirmWithdraw}
                  />
                </div>
              </AnimateScreen>
            ),
            loading: () => (
              <AnimateScreen
                key='loading'
                custom={animateScreenOptions}
                className='flex flex-1 min-h-0 flex-col'
              >
                <div
                  data-testid='withdraw-step-loading'
                  className='flex flex-1 min-h-0 flex-col'
                >
                  <LoadingStep destinationAddress={trimmedDestinationAddress} />
                </div>
              </AnimateScreen>
            ),
            error: () => (
              <AnimateScreen
                key='error'
                custom={animateScreenOptions}
                className='flex flex-1 min-h-0 flex-col'
              >
                <div
                  data-testid='withdraw-step-error'
                  className='flex flex-1 min-h-0 flex-col'
                >
                  <ErrorStep
                    error={withdrawError}
                    onBackToVault={() =>
                      navigate('vault-detail', { direction: 'back' })
                    }
                    onTryAgain={() => {
                      setWithdrawError(null);
                      goToStep('review', 'back');
                    }}
                  />
                </div>
              </AnimateScreen>
            )
          })}
        </AnimatePresence>
      </div>
    </Screen>
  );
};
