import { BootErrorScreen } from '@/components/boot-error-screen';
import { useCurrency } from '@/hooks/use-currency';
import { WalletContext } from '@/hooks/use-wallet';
import { ensurePresent } from '@/lib/assert';
import { attempt } from '@/lib/attempt';
import { toastMessages } from '@/lib/content';
import { match } from '@/lib/match';
import { convertDuration } from '@/lib/time';
import { sharedQueryKeys } from '@/lib/query-keys';
import { withZeroed } from '@/lib/secrets-zeroing';
import { vaultSnapshotsQueryOptions } from '@/modules/vaults/data/hooks';
import { vaultQueryKeys } from '@/modules/vaults/data/query-keys';
import { getLatestWithdrawalRecord } from '@/modules/vaults/lifecycle/adapter';
import type { VaultSnapshot } from '@/modules/vaults/types';
import {
  getMissingDefaultAccountChains,
  hasAccountForChain
} from '@/providers/default-accounts';
import { providerQueryKeys } from '@/providers/query-keys';
import {
  resolveReplacementVaultAction,
  type ReplacementAccountStatus
} from '@/providers/replacement-account';
import {
  repairUnsafeDefaultAccounts,
  type SafeVaultRepairWarningKind
} from '@/providers/safe-account-repair';
import {
  assertWithdrawalResultIdentity,
  failedWithdrawalErrorMessage
} from '@/providers/withdrawal-result';
import {
  buildLatestWithdrawalRecordByAccountId,
  isPostWithdrawComplete,
  loadLatestWithdrawalRecordByAccountId,
  mergeLatestWithdrawalRecordByAccountId,
  selectWithdrawalRecordToReconcile,
  resolvePostWithdrawSourceState,
  type LatestWithdrawalRecordByAccountId
} from '@/providers/withdrawal-lifecycle';
import {
  invalidateVaultAccountQueriesForSession,
  resolvePostWithdrawAccountIdsToInvalidate,
  resolveOwnedDestinationAccountId,
  resolveOwnedWithdrawalDestinationAccountId
} from '@/providers/wallet-query-invalidation';
import {
  getBitcoinApiUrl,
  getEthereumBundlerApiKey,
  getEthereumBundlerRpcUrl,
  getEthereumRpcUrl,
  getRegisterUrl
} from '@/lib/env';
import { assertNoNonInterfaceAssetBalances } from '@/lib/vault-operations';
import {
  loadWalletSummary,
  useWalletSummaryQuery,
  type WalletSummaryMode
} from '@/providers/wallet-queries';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChainId,
  LibQC,
  Mnemonic,
  toChain,
  WebStorage,
  type AddressIndex,
  type Asset,
  type AssetName,
  type BundlerConfigProvider,
  type ChainName,
  type ChainNetwork,
  type ChainSpecification,
  type Decimals,
  type EmptyVaultResult,
  type IconUrl,
  type Password,
  type PersistedAccount,
  type RpcUrl,
  type Symbol,
  type Testnet,
  type WithdrawalRecord
} from '@project-eleven/libqc';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

export type WalletProviderState = {
  sessionId: number;
  accounts: Array<PersistedAccount>;
  assets: Array<Asset>;
  vault: LibQC;
  selectedAccount?: PersistedAccount;
  selectedAsset?: Asset;
  initWallet(options?: InitWalletOptions): Promise<InitWalletResult>;
  refreshBalances(): Promise<void>;
  createAccount(chainId: ChainId, addressIndex?: AddressIndex): Promise<void>;
  ensureDefaultAccounts(): Promise<void>;
  selectAccount(account: PersistedAccount): void;
  selectAsset(asset: Asset): void;
  clearWalletState(): void;
  deleteWalletData(): Promise<void>;
  clearSelectedAccount(): void;
  recoverWallet(mnemonic: Mnemonic, password: Password): Promise<void>;
  exportRecoveryPhrase(password: Password): Promise<Mnemonic>;
  withdrawSyncState: WithdrawSyncState;
  /**
   * Clears a terminal withdraw sync state (`failed` / `timeout`) from the
   * home banner. No-op when the state is `idle` or `syncing` so callers
   * cannot accidentally interrupt an in-flight reconcile.
   */
  clearWithdrawSyncState(): void;
  latestWithdrawalRecordByAccountId: LatestWithdrawalRecordByAccountId;
  /**
   * Sweeps all assets in the selected vault to `destinationAddress`,
   * then automatically creates a new vault on the same chain and
   * refreshes the account list.
   */
  withdrawVaultFunds(
    destinationAddress: string
  ): Promise<WithdrawVaultFundsResult>;
};

type InitWalletResult = 'ready' | 'degraded' | 'ignored';
type DefaultAccountRepairResult = 'noop' | 'repaired';

type InitWalletOptions = {
  validateBalanceProvider?: boolean;
  forceRefreshInventory?: boolean;
  defaultAccountRepairResult?: DefaultAccountRepairResult;
};

export type WithdrawSyncStatus = 'idle' | 'syncing' | 'timeout' | 'failed';

export type WithdrawSyncState = {
  status: WithdrawSyncStatus;
  accountId: string | null;
  chainId: string | null;
};

export type WithdrawVaultFundsResult = {
  syncStatus: 'syncing' | 'failed';
};

type WithdrawReconcileSyncVisibility = 'visible' | 'silent';

const storage = new WebStorage();
const bitcoinMainnetReference = '000000000019d6689c085ae165831e93';
const emptyAccounts: Array<PersistedAccount> = [];
const emptyAssets: Array<Asset> = [];
const withdrawReconcileIntervalMs = convertDuration(2, 's', 'ms');
const withdrawReconcileTimeoutMs = convertDuration(30, 's', 'ms');
const optimisticWithdrawalRecordIdPrefix = 'optimistic-';
const buildOptimisticWithdrawalRecordId = ({
  accountId,
  initiatedAt
}: {
  accountId: string;
  initiatedAt: number;
}): string =>
  `${optimisticWithdrawalRecordIdPrefix}${accountId}-${initiatedAt}`;
const idleWithdrawSyncState: WithdrawSyncState = {
  status: 'idle',
  accountId: null,
  chainId: null
};

const toRpcUrl = (value: string): RpcUrl => value as RpcUrl;

/**
 * Builds the chain spec list lazily so the env getters
 * (`getBitcoinApiUrl`, `getEthereumRpcUrl`) are invoked at wallet boot
 * time inside an `attempt()` boundary, not at module-import time.
 *
 * If this lived at module scope, a missing env var would throw before
 * any React boundary could catch it and the popup would fail to mount
 * with a cryptic error.
 */
const buildChains = (): ChainSpecification[] => [
  {
    id: 0,
    chainId: new ChainId({
      namespace: 'bip122',
      reference: bitcoinMainnetReference
    }),
    name: 'Bitcoin' as ChainName,
    network: 'bitcoin' as ChainNetwork,
    iconUrl:
      'https://assets.coingecko.com/coins/images/1/large/bitcoin.png' as IconUrl,
    nativeCurrency: {
      decimals: 8 as Decimals,
      name: 'Bitcoin' as AssetName,
      symbol: 'BTC' as Symbol
    },
    testnet: false as Testnet,
    rpcUrls: [toRpcUrl(getBitcoinApiUrl())]
  },
  {
    id: 1,
    chainId: new ChainId({ namespace: 'eip155', reference: '1' }),
    name: 'Ethereum' as ChainName,
    network: 'ethereum' as ChainNetwork,
    iconUrl:
      'https://assets.coingecko.com/asset_platforms/images/279/large/ethereum.png' as IconUrl,
    nativeCurrency: {
      decimals: 18 as Decimals,
      name: 'Ether' as AssetName,
      symbol: 'ETH' as Symbol
    },
    testnet: false as Testnet,
    rpcUrls: [toRpcUrl(getEthereumRpcUrl())]
  }
];

/**
 * Creates a bundler config provider closed over the same resolved chain
 * list that LibQC receives. The factory shape exists so both LibQC and
 * the bundler provider can be constructed lazily inside the boot
 * `attempt()` block, sharing one `chains` array. The bundler env reads
 * (`getEthereumBundlerRpcUrl`, `getEthereumBundlerApiKey`) stay lazy -
 * they only throw when an account-abstraction transaction is actually
 * submitted, not at boot.
 */
const createBundlerConfigProvider =
  (chains: ChainSpecification[]): BundlerConfigProvider =>
  chainId => {
    const chain = chains.find(c => c.chainId.toString() === chainId.toString());
    if (!chain) {
      throw new Error(`Chain ${chainId.toString()} not supported`);
    }

    if (chainId.toString() === 'eip155:1') {
      return {
        chain: toChain(chain),
        urls: [toRpcUrl(getEthereumBundlerRpcUrl())],
        headers: {
          // P11TODO: remove once we no longer need to pass an API key
          Authorization: `Bearer ${getEthereumBundlerApiKey()}`
        }
      };
    }

    throw new Error(`Chain ${chainId.toString()} not supported`);
  };

/**
 * libqc 0.0.19's `AccountClientInterface` does not declare `emptyVault` (it
 * lives on the concrete `EvmAccountClient` / `BitcoinAccountClient` classes
 * only), so `vault.getAccount` returns a value whose static type lacks the
 * sweep capability. This guard narrows the structural shape and is the
 * single boundary cast for that gap. If/when the SDK promotes `emptyVault`
 * onto the interface, drop this guard and call `accountClient.emptyVault`
 * directly.
 */
type WithdrawCapableAccountClient = {
  emptyVault: (destinationAddress: string) => Promise<EmptyVaultResult>;
};

const hasWithdrawCapability = (
  accountClient: object
): accountClient is typeof accountClient & WithdrawCapableAccountClient =>
  'emptyVault' in accountClient &&
  typeof accountClient.emptyVault === 'function';

const waitForMs = (durationMs: number): Promise<void> =>
  new Promise(resolve => {
    window.setTimeout(resolve, durationMs);
  });

const extractWarnableError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const safeVaultRepairWarningMessage: Record<
  SafeVaultRepairWarningKind,
  string
> = {
  'account-creation-failed': 'Failed to create safe vault repair account',
  'status-inspection-failed': 'Skipped safe vault repair'
};

const getSameChainAccountIds = ({
  accounts,
  chainId
}: {
  accounts: ReadonlyArray<PersistedAccount>;
  chainId: string;
}): ReadonlySet<string> =>
  new Set(
    accounts
      .filter(account => account.chainId.toString() === chainId)
      .map(account => account.id.toString())
  );

const getSourceSnapshotFromCache = ({
  queryClient,
  requestedCurrency,
  requestedSessionId,
  sourceAccountId
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  requestedCurrency: ReturnType<typeof useCurrency>['currency'];
  requestedSessionId: number;
  sourceAccountId: string;
}): VaultSnapshot | undefined => {
  const scopedSnapshotEntries = queryClient.getQueriesData<
    Partial<Record<string, VaultSnapshot>>
  >({
    queryKey: vaultQueryKeys.snapshotsScope({
      sessionId: requestedSessionId,
      currency: requestedCurrency
    })
  });

  const sourceSnapshotEntry = scopedSnapshotEntries.find(([, snapshots]) =>
    snapshots ? sourceAccountId in snapshots : false
  );
  return sourceSnapshotEntry?.[1]?.[sourceAccountId];
};

type OptimisticWithdrawalStatus = Exclude<EmptyVaultResult['status'], 'failed'>;

/**
 * Build an optimistic `WithdrawalRecord` to mirror the SDK's lifecycle
 * record while the just-submitted withdrawal is still propagating through
 * `emptyVault`'s persistence + indexing window. Callers must reject failed
 * results before invoking this helper, so `failed`/`failedAt` are never
 * possible here — only `pending` (BTC just-broadcast) and `sent` (EVM with
 * userop receipt already returned) survive.
 */
const buildOptimisticWithdrawalRecord = ({
  result,
  status,
  initiatedAt
}: {
  result: EmptyVaultResult;
  status: OptimisticWithdrawalStatus;
  initiatedAt: number;
}): WithdrawalRecord => ({
  id: buildOptimisticWithdrawalRecordId({
    accountId: result.accountId,
    initiatedAt
  }),
  accountId: result.accountId,
  destinationAddress: result.destinationAddress,
  destinationChain: result.destinationChain,
  initiatedAt,
  sentAt: status === 'sent' ? initiatedAt : null,
  completedAt: null,
  failedAt: null,
  status,
  txRefs: result.txIdentifiers
});

/**
 * Thin boot gate. Constructs `LibQC` exactly once via `attempt()` so a
 * missing env var (or any other LibQC construction failure) becomes a
 * `BootErrorScreen` instead of a synchronous throw that crashes the
 * React tree.
 *
 * This component owns ONLY the two refs and the early return. All
 * existing state, hooks, callbacks, and the context value live in
 * `WalletProviderReady`, which receives the resolved vault as a prop
 * and either fully mounts or never mounts. That separation keeps hook
 * order consistent and satisfies the Rules of Hooks - if the boot gate
 * also owned `useCurrency`, `useState`, `useCallback`, etc., the early
 * return would put those hooks behind a conditional and React would
 * (correctly) flag it.
 */
export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const vaultRef = useRef<LibQC | null>(null);
  const bootErrorRef = useRef<Error | null>(null);

  if (vaultRef.current === null && bootErrorRef.current === null) {
    const result = attempt(() => {
      const chains = buildChains();
      return new LibQC(
        storage,
        chains,
        createBundlerConfigProvider(chains),
        undefined,
        {
          registerUrl: getRegisterUrl()
        }
      );
    });
    if ('error' in result) {
      bootErrorRef.current =
        result.error instanceof Error
          ? result.error
          : new Error(String(result.error));
    } else {
      vaultRef.current = result.data;
    }
  }

  if (bootErrorRef.current !== null) {
    return <BootErrorScreen error={bootErrorRef.current} />;
  }

  const vault = ensurePresent(
    vaultRef.current,
    'wallet vault after boot guard'
  );

  return <WalletProviderReady vault={vault}>{children}</WalletProviderReady>;
};

type WalletProviderReadyProps = {
  vault: LibQC;
  children: React.ReactNode;
};

/**
 * Provides in-memory state for wallet data. Mounted only after the
 * boot gate has resolved a `LibQC` instance, so `vault` here is
 * guaranteed-present by construction.
 */
const WalletProviderReady = ({ vault, children }: WalletProviderReadyProps) => {
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  const mountedRef = useRef(true);
  const sessionIdRef = useRef(0);
  const ensureDefaultAccountsInFlightRef =
    useRef<Promise<DefaultAccountRepairResult> | null>(null);
  const withdrawReconcileRequestIdRef = useRef(0);
  const inFlightWithdrawalRecordIdsRef = useRef<Set<string>>(new Set());
  const settledWithdrawalRecordIdsRef = useRef<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState(0);
  const [isWalletUnlocked, setIsWalletUnlocked] = useState(() =>
    vault.isUnlocked()
  );
  const [withdrawSyncState, setWithdrawSyncState] = useState<WithdrawSyncState>(
    idleWithdrawSyncState
  );

  const [selectedAccount, setSelectedAccount] =
    useState<WalletProviderState['selectedAccount']>();

  const [selectedAsset, setSelectedAsset] =
    useState<WalletProviderState['selectedAsset']>();
  const [
    latestWithdrawalRecordByAccountId,
    setLatestWithdrawalRecordByAccountId
  ] = useState<LatestWithdrawalRecordByAccountId>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const walletSummaryQuery = useWalletSummaryQuery({
    currency,
    isEnabled: isWalletUnlocked,
    mode: 'inventory-only',
    sessionId,
    vault
  });
  const walletSummary = walletSummaryQuery.data;
  const accounts = walletSummary?.accounts ?? emptyAccounts;
  const assets = walletSummary?.assets ?? emptyAssets;

  const loadSummaryForSession = useCallback(
    async ({
      forceRefresh = false,
      mode,
      requestedCurrency,
      requestedSessionId
    }: {
      forceRefresh?: boolean;
      mode: WalletSummaryMode;
      requestedCurrency: typeof currency;
      requestedSessionId: number;
    }) => {
      if (forceRefresh) {
        await queryClient.invalidateQueries({
          queryKey: providerQueryKeys.summary({
            currency: requestedCurrency,
            mode,
            sessionId: requestedSessionId
          }),
          exact: true,
          refetchType: 'none'
        });
      }

      return queryClient.fetchQuery({
        queryKey: providerQueryKeys.summary({
          currency: requestedCurrency,
          mode,
          sessionId: requestedSessionId
        }),
        queryFn: () =>
          loadWalletSummary({
            currency: requestedCurrency,
            mode,
            vault
          })
      });
    },
    [queryClient, vault]
  );

  const invalidateWalletQueriesForSession = useCallback(
    ({
      requestedCurrency,
      requestedSessionId
    }: {
      requestedCurrency: typeof currency;
      requestedSessionId: number;
    }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: vaultQueryKeys.snapshotsScope({
            sessionId: requestedSessionId,
            currency: requestedCurrency
          })
        }),
        queryClient.invalidateQueries({
          queryKey: vaultQueryKeys.accountDataScope({
            sessionId: requestedSessionId
          })
        }),
        queryClient.invalidateQueries({
          queryKey: vaultQueryKeys.accountActivitiesScope({
            sessionId: requestedSessionId
          })
        }),
        queryClient.invalidateQueries({
          queryKey: vaultQueryKeys.vaultDetailScope({
            sessionId: requestedSessionId
          })
        })
      ]),
    [queryClient]
  );

  /**
   * Narrow invalidator used inside the reconcile loop. Always invalidates
   * the session-wide snapshots scope (cheap; covers the source vault and
   * any newly visible replacement vault). Per-account `accountData`,
   * `accountActivities`, and `vaultDetail` keys are invalidated only for
   * the accounts the loop already references (source + replacement once
   * detected) so unrelated vaults are not refetched on every poll tick.
   */
  const invalidateWithdrawReconcileQueriesForSession = useCallback(
    ({
      requestedCurrency,
      requestedSessionId,
      accountIds
    }: {
      requestedCurrency: typeof currency;
      requestedSessionId: number;
      accountIds: ReadonlyArray<string>;
    }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: vaultQueryKeys.snapshotsScope({
            sessionId: requestedSessionId,
            currency: requestedCurrency
          })
        }),
        invalidateVaultAccountQueriesForSession({
          queryClient,
          requestedCurrency,
          requestedSessionId,
          accountIds
        })
      ]),
    [queryClient]
  );

  const repairDefaultAccounts =
    useCallback(async (): Promise<DefaultAccountRepairResult> => {
      if (!vault.isUnlocked()) {
        throw new Error('Default account repair requires an unlocked vault');
      }

      if (ensureDefaultAccountsInFlightRef.current) {
        return ensureDefaultAccountsInFlightRef.current;
      }

      const request = (async () => {
        const accounts = await vault.listAccounts();
        const missingDefaultChains = getMissingDefaultAccountChains({
          accounts,
          supportedChains: vault.getSupportedChains()
        });

        for (const chain of missingDefaultChains) {
          const latestAccounts = await vault.listAccounts();
          const isChainStillMissing = !hasAccountForChain({
            accounts: latestAccounts,
            chainId: chain.chainId
          });
          if (!isChainStillMissing) {
            continue;
          }

          await vault.createAccount(chain.chainId);
        }

        // Safety net: every default chain that already had accounts is now
        // inspected for a `safe` account. If a popup-close race during a
        // prior withdraw (or any pre-PR-#276 state) left a chain with only
        // vulnerable accounts, mint a fresh safe vault at the next index.
        // Status inspection is best-effort: transient chain/RPC failures must
        // not block wallet hydration for an otherwise usable vault.
        const safetyNetCreatedCount = await repairUnsafeDefaultAccounts({
          vault,
          onRepairWarning: ({ chainId, error, kind }) => {
            console.warn(
              `${safeVaultRepairWarningMessage[kind]} for chain ${chainId.toString()}:`,
              extractWarnableError(error)
            );
          }
        });

        const repairCount = missingDefaultChains.length + safetyNetCreatedCount;
        return repairCount > 0 ? 'repaired' : 'noop';
      })();

      ensureDefaultAccountsInFlightRef.current = request;
      try {
        return await request;
      } finally {
        if (ensureDefaultAccountsInFlightRef.current === request) {
          ensureDefaultAccountsInFlightRef.current = null;
        }
      }
    }, [vault]);

  const initWallet = useCallback(
    async (options: InitWalletOptions = {}): Promise<InitWalletResult> => {
      if (!vault.isUnlocked()) {
        return 'ignored';
      }

      const {
        forceRefreshInventory = false,
        validateBalanceProvider = false,
        defaultAccountRepairResult
      } = options;
      const requestedSessionId = sessionIdRef.current;
      const didRepairDefaultAccounts = defaultAccountRepairResult
        ? defaultAccountRepairResult === 'repaired'
        : (await repairDefaultAccounts()) === 'repaired';
      if (requestedSessionId !== sessionIdRef.current || !vault.isUnlocked()) {
        return 'ignored';
      }

      const accounts = await vault.listAccounts();
      const loadedLatestRecords = await loadLatestWithdrawalRecordByAccountId({
        accounts,
        vault
      });

      const inventorySummary = await loadSummaryForSession({
        forceRefresh: forceRefreshInventory || didRepairDefaultAccounts,
        mode: 'inventory-only',
        requestedCurrency: currency,
        requestedSessionId
      });

      if (requestedSessionId !== sessionIdRef.current || !vault.isUnlocked()) {
        return 'ignored';
      }

      void invalidateWalletQueriesForSession({
        requestedCurrency: currency,
        requestedSessionId
      });
      setLatestWithdrawalRecordByAccountId(previous =>
        mergeLatestWithdrawalRecordByAccountId({
          previous,
          loaded: loadedLatestRecords
        })
      );
      setIsWalletUnlocked(true);

      if (inventorySummary.isBalanceProviderUnavailable) {
        return 'degraded';
      }

      if (!validateBalanceProvider) {
        return 'ready';
      }

      const fullSummary = await loadSummaryForSession({
        forceRefresh: forceRefreshInventory || didRepairDefaultAccounts,
        mode: 'full',
        requestedCurrency: currency,
        requestedSessionId
      });
      if (requestedSessionId !== sessionIdRef.current || !vault.isUnlocked()) {
        return 'ignored';
      }

      return fullSummary.isBalanceProviderUnavailable ? 'degraded' : 'ready';
    },
    [
      currency,
      invalidateWalletQueriesForSession,
      loadSummaryForSession,
      repairDefaultAccounts,
      vault
    ]
  );

  const refreshBalances = useCallback(async (): Promise<void> => {
    if (!vault.isUnlocked()) {
      return;
    }
    const requestedSessionId = sessionIdRef.current;
    const summary = await loadSummaryForSession({
      mode: 'inventory-only',
      requestedCurrency: currency,
      requestedSessionId
    });
    if (requestedSessionId !== sessionIdRef.current || !vault.isUnlocked()) {
      return;
    }
    await invalidateWalletQueriesForSession({
      requestedCurrency: currency,
      requestedSessionId
    });
    if (summary.isBalanceProviderUnavailable) {
      throw new Error('Wallet inventory unavailable');
    }
  }, [
    currency,
    invalidateWalletQueriesForSession,
    loadSummaryForSession,
    vault
  ]);

  const createAccount = useCallback(
    async (chainId: ChainId, addressIndex?: AddressIndex) => {
      await vault.createAccount(chainId, undefined, undefined, addressIndex);

      await initWallet();
    },
    [initWallet, vault]
  );

  const ensureDefaultAccounts = useCallback(async () => {
    const defaultAccountRepairResult = await repairDefaultAccounts();
    const initWalletResult = await initWallet({
      defaultAccountRepairResult,
      forceRefreshInventory: defaultAccountRepairResult === 'repaired'
    });
    if (initWalletResult === 'ignored') {
      throw new Error('Default account repair was interrupted');
    }
  }, [initWallet, repairDefaultAccounts]);

  const recoverWallet = useCallback(
    async (mnemonic: Mnemonic, password: Password) =>
      withZeroed([mnemonic, password], async () => {
        await vault.clearState();
        await vault.importWallet(mnemonic, password);
        await initWallet();
      }),
    [initWallet, vault]
  );

  const exportRecoveryPhrase = useCallback(
    (password: Password): Promise<Mnemonic> =>
      withZeroed(password, () =>
        vault.exportMnemonic(password, mnemonic => Mnemonic.from(mnemonic))
      ),
    [vault]
  );

  const selectAccount = useCallback((account: PersistedAccount) => {
    setSelectedAccount(account);
  }, []);

  const clearSelectedAccount = useCallback(() => {
    setSelectedAccount(undefined);
  }, []);

  const clearWalletState = useCallback(() => {
    const nextSessionId = sessionIdRef.current + 1;
    sessionIdRef.current = nextSessionId;
    withdrawReconcileRequestIdRef.current += 1;
    setSessionId(nextSessionId);
    setIsWalletUnlocked(false);

    setSelectedAccount(undefined);
    setSelectedAsset(undefined);
    setWithdrawSyncState(idleWithdrawSyncState);
    setLatestWithdrawalRecordByAccountId({});
    inFlightWithdrawalRecordIdsRef.current = new Set();
    settledWithdrawalRecordIdsRef.current = new Set();

    // Defense-in-depth: synchronously remove cached entries so any consumer
    // reading right now sees an empty cache, then cancel in-flight queries
    // and re-remove anything they may have repopulated during the cancel
    // window. The async chain is intentionally fire-and-forget — `vault.lock`
    // below already prevents new SDK reads from succeeding.
    queryClient.removeQueries({ queryKey: sharedQueryKeys.all });
    void queryClient
      .cancelQueries({ queryKey: sharedQueryKeys.all })
      .finally(() =>
        queryClient.removeQueries({ queryKey: sharedQueryKeys.all })
      );

    vault.lock();
  }, [queryClient, vault]);

  const deleteWalletData = useCallback(async (): Promise<void> => {
    try {
      await vault.clearState();
    } finally {
      clearWalletState();
    }
  }, [clearWalletState, vault]);

  const selectAsset = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
  }, []);

  const clearWithdrawSyncState = useCallback(() => {
    setWithdrawSyncState(previous => {
      if (previous.status !== 'failed' && previous.status !== 'timeout') {
        return previous;
      }

      const sourceAccountId = previous.accountId;
      if (sourceAccountId !== null) {
        const sourceRecord = latestWithdrawalRecordByAccountId[sourceAccountId];
        if (sourceRecord) {
          settledWithdrawalRecordIdsRef.current.add(sourceRecord.id);
        }
      }

      return idleWithdrawSyncState;
    });
  }, [latestWithdrawalRecordByAccountId]);

  const reconcilePostWithdraw = useCallback(
    async ({
      requestId,
      requestedCurrency,
      requestedSessionId,
      sourceAccountId,
      sourceAccountIdRef,
      sourceAccount,
      sourceChainId,
      baselineSameChainAccountIds,
      initialLatestRecord,
      ownedDestinationAccountId,
      registerInFlightRecordId
    }: {
      requestId: number;
      requestedCurrency: typeof currency;
      requestedSessionId: number;
      sourceAccountId: string;
      sourceAccountIdRef: PersistedAccount['id'];
      sourceAccount: PersistedAccount;
      sourceChainId: string;
      baselineSameChainAccountIds: ReadonlySet<string>;
      initialLatestRecord: WithdrawalRecord | undefined;
      ownedDestinationAccountId: string | undefined;
      registerInFlightRecordId: (recordId: string) => void;
    }): Promise<Extract<WithdrawSyncStatus, 'idle' | 'timeout' | 'failed'>> => {
      const startedAt = Date.now();
      let latestSourceWithdrawalRecord = initialLatestRecord;
      const shouldAbortReconcile = (): boolean =>
        !mountedRef.current ||
        withdrawReconcileRequestIdRef.current !== requestId ||
        requestedSessionId !== sessionIdRef.current ||
        !vault.isUnlocked();

      while (Date.now() - startedAt <= withdrawReconcileTimeoutMs) {
        if (shouldAbortReconcile()) {
          return 'idle';
        }

        const refreshedSourceWithdrawalRecordsResult = await attempt(() =>
          vault.refreshWithdrawalLifecycle(sourceAccountIdRef)
        );

        if (shouldAbortReconcile()) {
          return 'idle';
        }

        if ('error' in refreshedSourceWithdrawalRecordsResult) {
          // Symmetric with `loadLatestWithdrawalRecordByAccountId`: surface
          // the underlying error so a persistent SDK failure is observable
          // instead of silently spinning until the loop times out.
          console.warn(
            `Failed to refresh withdrawal lifecycle for account ${sourceAccountId}:`,
            extractWarnableError(refreshedSourceWithdrawalRecordsResult.error)
          );
        } else {
          const refreshedRecords = refreshedSourceWithdrawalRecordsResult.data;
          latestSourceWithdrawalRecord =
            getLatestWithdrawalRecord(refreshedRecords);
          // Race fix: when the SDK indexer catches up and the latest record
          // for this account is no longer the original optimistic id, claim
          // the new SDK record id under the same in-flight tracking entry
          // BEFORE the state update is published. Without this, the
          // auto-resume effect would observe an in-flight record whose id is
          // not in `inFlightWithdrawalRecordIdsRef` and spawn a duplicate
          // reconcile coordinator for the same logical operation. The
          // caller's `finally` releases every id we register here.
          if (
            latestSourceWithdrawalRecord !== undefined &&
            initialLatestRecord !== undefined &&
            latestSourceWithdrawalRecord.id !== initialLatestRecord.id
          ) {
            registerInFlightRecordId(latestSourceWithdrawalRecord.id);
          }
          setLatestWithdrawalRecordByAccountId(previous =>
            buildLatestWithdrawalRecordByAccountId({
              accountId: sourceAccountId,
              records: refreshedRecords,
              previous
            })
          );
        }
        if (latestSourceWithdrawalRecord?.status === 'failed') {
          return 'failed';
        }

        const summaryResult = await attempt(() =>
          loadSummaryForSession({
            forceRefresh: true,
            mode: 'inventory-only',
            requestedCurrency,
            requestedSessionId
          })
        );
        const replacementAccount =
          'error' in summaryResult
            ? undefined
            : summaryResult.data.accounts.find(
                account =>
                  account.id.toString() !== sourceAccountId &&
                  account.chainId.toString() === sourceChainId &&
                  !baselineSameChainAccountIds.has(account.id.toString())
              );
        const accountIdsToInvalidate =
          resolvePostWithdrawAccountIdsToInvalidate({
            sourceAccountId,
            replacementAccountId: replacementAccount?.id.toString(),
            ownedDestinationAccountId
          });
        await invalidateWithdrawReconcileQueriesForSession({
          requestedCurrency,
          requestedSessionId,
          accountIds: accountIdsToInvalidate
        });
        const sourceSnapshotResult = await attempt(() =>
          queryClient.fetchQuery(
            vaultSnapshotsQueryOptions({
              accounts: [sourceAccount],
              vault,
              currency: requestedCurrency,
              sessionId: requestedSessionId,
              queryClient,
              stickyStatusByAccountId: {}
            })
          )
        );

        if (shouldAbortReconcile()) {
          return 'idle';
        }

        if (!('error' in summaryResult)) {
          const sourceSnapshot =
            'error' in sourceSnapshotResult
              ? getSourceSnapshotFromCache({
                  queryClient,
                  requestedCurrency,
                  requestedSessionId,
                  sourceAccountId
                })
              : ensurePresent(
                  sourceSnapshotResult.data[sourceAccountId],
                  `fresh source snapshot for account ${sourceAccountId}`
                );
          const sourceReflectsPostWithdraw = resolvePostWithdrawSourceState({
            sourceAccountId,
            summaryAccounts: summaryResult.data.accounts,
            sourceLatestWithdrawalRecord: latestSourceWithdrawalRecord,
            sourceSnapshot
          });

          if (
            isPostWithdrawComplete({
              ownedDestinationAccountId,
              replacementAccount,
              sourceReflectsPostWithdraw
            })
          ) {
            return 'idle';
          }
        }

        const elapsedMs = Date.now() - startedAt;
        const remainingMs = withdrawReconcileTimeoutMs - elapsedMs;
        if (remainingMs <= 0) {
          break;
        }

        await waitForMs(Math.min(withdrawReconcileIntervalMs, remainingMs));
      }

      return 'timeout';
    },
    [
      invalidateWithdrawReconcileQueriesForSession,
      loadSummaryForSession,
      queryClient,
      vault
    ]
  );

  const startPostWithdrawReconciliation = useCallback(
    ({
      sourceAccount,
      baselineSameChainAccountIds,
      sourceRecordId,
      initialLatestRecord,
      ownedDestinationAccountId,
      syncVisibility
    }: {
      sourceAccount: PersistedAccount;
      baselineSameChainAccountIds: ReadonlySet<string>;
      sourceRecordId?: string;
      initialLatestRecord: WithdrawalRecord | undefined;
      ownedDestinationAccountId?: string;
      syncVisibility: WithdrawReconcileSyncVisibility;
    }): WithdrawVaultFundsResult => {
      const sourceAccountId = sourceAccount.id.toString();
      const sourceChainId = sourceAccount.chainId.toString();
      const requestedCurrency = currency;
      const requestedSessionId = sessionIdRef.current;
      const requestId = withdrawReconcileRequestIdRef.current + 1;
      withdrawReconcileRequestIdRef.current = requestId;
      // Track every record id we register for this reconcile session so the
      // cleanup `finally` can release all of them — including the SDK record
      // id that the loop may register when the indexer catches up and the
      // optimistic id is replaced.
      const registeredInFlightRecordIds = new Set<string>();
      const registerInFlightRecordId = (recordId: string) => {
        if (registeredInFlightRecordIds.has(recordId)) return;
        registeredInFlightRecordIds.add(recordId);
        inFlightWithdrawalRecordIdsRef.current.add(recordId);
      };
      if (sourceRecordId !== undefined) {
        registerInFlightRecordId(sourceRecordId);
      }
      const buildSyncState = (
        status: Exclude<WithdrawSyncStatus, 'idle'>
      ): WithdrawSyncState => ({
        status,
        accountId: sourceAccountId,
        chainId: sourceChainId
      });
      const settleRegisteredRecordIds = () => {
        for (const recordId of registeredInFlightRecordIds) {
          settledWithdrawalRecordIdsRef.current.add(recordId);
        }
      };
      const shouldPublishSyncState = syncVisibility === 'visible';
      if (shouldPublishSyncState) {
        setWithdrawSyncState(buildSyncState('syncing'));
      }

      void (async () => {
        try {
          const reconcileResult = await attempt(() =>
            reconcilePostWithdraw({
              requestId,
              requestedCurrency,
              requestedSessionId,
              sourceAccountId,
              sourceAccountIdRef: sourceAccount.id,
              sourceAccount,
              sourceChainId,
              baselineSameChainAccountIds,
              initialLatestRecord,
              ownedDestinationAccountId,
              registerInFlightRecordId
            })
          );

          if (
            !mountedRef.current ||
            withdrawReconcileRequestIdRef.current !== requestId
          ) {
            return;
          }

          if ('error' in reconcileResult) {
            settleRegisteredRecordIds();
            if (shouldPublishSyncState) {
              setWithdrawSyncState(buildSyncState('failed'));
            }
            return;
          }

          match(reconcileResult.data, {
            idle: () => {
              settleRegisteredRecordIds();
              if (shouldPublishSyncState) {
                setWithdrawSyncState(idleWithdrawSyncState);
              }
            },
            timeout: () => {
              settleRegisteredRecordIds();
              if (shouldPublishSyncState) {
                setWithdrawSyncState(buildSyncState('timeout'));
              }
            },
            failed: () => {
              settleRegisteredRecordIds();
              if (shouldPublishSyncState) {
                // Surface a toast in addition to the home banner because the
                // user may be on a screen that does not render the banner.
                toast.error(toastMessages.withdrawalDetectedAsFailed);
                setWithdrawSyncState(buildSyncState('failed'));
              }
            }
          });
        } finally {
          for (const recordId of registeredInFlightRecordIds) {
            inFlightWithdrawalRecordIdsRef.current.delete(recordId);
          }
        }
      })();

      return { syncStatus: 'syncing' };
    },
    [currency, reconcilePostWithdraw]
  );

  useEffect(() => {
    if (!isWalletUnlocked || withdrawSyncState.status !== 'idle') {
      return;
    }

    const recordEntryToReconcile = selectWithdrawalRecordToReconcile({
      latestWithdrawalRecordByAccountId,
      accounts,
      inFlightWithdrawalRecordIds: inFlightWithdrawalRecordIdsRef.current,
      settledWithdrawalRecordIds: settledWithdrawalRecordIdsRef.current
    });
    if (!recordEntryToReconcile) {
      return;
    }
    const { accountId: sourceAccountId, record: sourceRecord } =
      recordEntryToReconcile;
    const sourceAccount = ensurePresent(
      accounts.find(account => account.id.toString() === sourceAccountId),
      `source account ${sourceAccountId}`
    );
    const ownedDestinationAccountId =
      resolveOwnedWithdrawalDestinationAccountId({
        accounts,
        sourceAccount,
        withdrawalRecord: sourceRecord
      });

    startPostWithdrawReconciliation({
      sourceAccount,
      baselineSameChainAccountIds: getSameChainAccountIds({
        accounts,
        chainId: sourceAccount.chainId.toString()
      }),
      sourceRecordId: sourceRecord.id,
      initialLatestRecord: sourceRecord,
      ownedDestinationAccountId,
      syncVisibility: 'silent'
    });
  }, [
    accounts,
    isWalletUnlocked,
    latestWithdrawalRecordByAccountId,
    startPostWithdrawReconciliation,
    withdrawSyncState.status
  ]);

  const withdrawVaultFunds = useCallback(
    async (destinationAddress: string): Promise<WithdrawVaultFundsResult> => {
      if (!selectedAccount) {
        throw new Error('No account selected');
      }
      if (!vault.isUnlocked()) {
        throw new Error('Wallet is locked');
      }
      const requestedSessionId = sessionIdRef.current;
      const accountClient = await vault.getAccount(selectedAccount.id);
      if (requestedSessionId !== sessionIdRef.current || !vault.isUnlocked()) {
        throw new Error('Wallet session changed during withdrawal');
      }

      if (!hasWithdrawCapability(accountClient)) {
        throw new Error('Vault withdrawal is not supported for this account');
      }

      await assertNoNonInterfaceAssetBalances(vault, selectedAccount);
      if (requestedSessionId !== sessionIdRef.current || !vault.isUnlocked()) {
        throw new Error('Wallet session changed during withdrawal');
      }

      const result = await accountClient.emptyVault(destinationAddress);
      if (requestedSessionId !== sessionIdRef.current || !vault.isUnlocked()) {
        throw new Error('Wallet session changed during withdrawal');
      }
      if (result.transferredAssetCount === 0) {
        throw new Error('No assets were transferred');
      }
      assertWithdrawalResultIdentity({
        result,
        selectedAccount
      });
      if (result.status === 'failed') {
        throw new Error(failedWithdrawalErrorMessage);
      }
      const optimisticStatus: OptimisticWithdrawalStatus = result.status;
      const sourceAccountId = selectedAccount.id.toString();
      const sourceChainId = selectedAccount.chainId.toString();
      const sameChainAccountStatuses = await Promise.all(
        accounts
          .filter(account => account.chainId.toString() === sourceChainId)
          .map(async account => {
            const statusResult = await attempt<ReplacementAccountStatus>(
              async () => {
                const accountClientForStatus = await vault.getAccount(
                  account.id
                );
                return accountClientForStatus.getStatus();
              }
            );
            const status: ReplacementAccountStatus | 'unknown' =
              'data' in statusResult && statusResult.data !== undefined
                ? statusResult.data
                : 'unknown';

            return {
              id: account.id,
              chainId: account.chainId,
              status
            };
          })
      );
      const ownedDestinationAccountId = resolveOwnedDestinationAccountId({
        accounts,
        destinationAddress: result.destinationAddress,
        sourceAccount: selectedAccount
      });
      const baselineSameChainAccountIds = getSameChainAccountIds({
        accounts,
        chainId: sourceChainId
      });
      const initiatedAt = Date.now();
      const optimisticRecord = buildOptimisticWithdrawalRecord({
        result,
        status: optimisticStatus,
        initiatedAt
      });
      setLatestWithdrawalRecordByAccountId(previous => ({
        ...previous,
        [sourceAccountId]: optimisticRecord
      }));

      const replacementVaultAction = resolveReplacementVaultAction({
        accounts: sameChainAccountStatuses,
        sourceChainId: selectedAccount.chainId,
        sourceAccountId,
        ownedDestinationAccountId
      });
      if (replacementVaultAction.kind === 'create') {
        const createReplacementVaultResult = await attempt(() =>
          createAccount(
            selectedAccount.chainId,
            replacementVaultAction.addressIndex
          )
        );
        if ('error' in createReplacementVaultResult) {
          toast.error(toastMessages.walletSyncFailed);
          setWithdrawSyncState({
            status: 'failed',
            accountId: sourceAccountId,
            chainId: sourceChainId
          });
          return { syncStatus: 'failed' };
        }
      }

      return startPostWithdrawReconciliation({
        sourceAccount: selectedAccount,
        baselineSameChainAccountIds,
        sourceRecordId: optimisticRecord.id,
        initialLatestRecord: optimisticRecord,
        ownedDestinationAccountId,
        syncVisibility: 'visible'
      });
    },
    [
      accounts,
      createAccount,
      selectedAccount,
      startPostWithdrawReconciliation,
      vault
    ]
  );

  const contextValue = useMemo(
    () => ({
      sessionId,
      accounts,
      assets,
      selectedAccount,
      vault,
      selectedAsset,
      withdrawSyncState,
      clearWithdrawSyncState,
      latestWithdrawalRecordByAccountId,
      initWallet,
      refreshBalances,
      createAccount,
      ensureDefaultAccounts,
      selectAccount,
      selectAsset,
      clearWalletState,
      deleteWalletData,
      clearSelectedAccount,
      recoverWallet,
      exportRecoveryPhrase,
      withdrawVaultFunds
    }),
    [
      accounts,
      assets,
      sessionId,
      selectedAccount,
      selectedAsset,
      withdrawSyncState,
      clearWithdrawSyncState,
      latestWithdrawalRecordByAccountId,
      vault,
      initWallet,
      refreshBalances,
      createAccount,
      ensureDefaultAccounts,
      selectAccount,
      selectAsset,
      clearWalletState,
      deleteWalletData,
      clearSelectedAccount,
      recoverWallet,
      exportRecoveryPhrase,
      withdrawVaultFunds
    ]
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};
