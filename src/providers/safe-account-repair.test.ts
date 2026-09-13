import { describe, expect, it, vi } from 'vitest';
import type { ChainId } from '@project-eleven/libqc';

// Mirror the libqc surface mocks used by `replacement-account.test.ts`. The
// helper only needs `isBitcoinChain`; everything else is type-only.
vi.mock('@project-eleven/libqc', () => ({
  isBitcoinChain: (chainId: { namespace: string }) =>
    chainId.namespace === 'bip122'
}));

import {
  getDefaultChainGroupsToInspect,
  maxSafeVaultRepairsPerChain,
  repairUnsafeDefaultAccounts,
  resolveSafeVaultRepairAction,
  type AccountStatus
} from './safe-account-repair';

const bitcoinMainnetChainId = 'bip122:000000000019d6689c085ae165831e93';
const ethereumChainId = 'eip155:1';
const unsupportedChainId = 'eip155:42161';

const createChainId = (value: string): ChainId => {
  const [namespace, reference] = value.split(':');
  return {
    namespace,
    reference,
    toString: () => value,
    toJSON: () => ({ namespace, reference })
  };
};

type TestPersistedAccountId = {
  toString(): string;
};

type TestAccount = {
  id: TestPersistedAccountId;
  chainId: ChainId;
};

const createAccount = (
  chainIdValue: string,
  idSuffix: string
): TestAccount => ({
  id: {
    toString: () => `${chainIdValue}:${idSuffix}`
  } satisfies TestPersistedAccountId,
  chainId: createChainId(chainIdValue)
});

const createStatusEntry = (status: AccountStatus) => status;

type RepairVaultInput = {
  accounts: ReadonlyArray<TestAccount>;
  supportedChains: ReadonlyArray<{ chainId: ChainId }>;
  statusesByAccountId: Readonly<Record<string, AccountStatus>>;
  statusErrorByAccountId?: Readonly<Record<string, Error>>;
  createAccount?: ReturnType<typeof vi.fn>;
};

const createRepairVault = ({
  accounts,
  supportedChains,
  statusesByAccountId,
  statusErrorByAccountId = {},
  createAccount = vi.fn(async () => undefined)
}: RepairVaultInput) => ({
  listAccounts: vi.fn(async () => accounts),
  getSupportedChains: vi.fn(() => supportedChains),
  getAccount: vi.fn(async (accountId: TestPersistedAccountId) => ({
    getStatus: vi.fn(async () => {
      const error = statusErrorByAccountId[accountId.toString()];
      if (error !== undefined) {
        throw error;
      }

      const status = statusesByAccountId[accountId.toString()];
      if (status === undefined) {
        throw new Error(`No account status for ${accountId.toString()}`);
      }

      return status;
    })
  })),
  createAccount
});

/**
 * Mirrors a recovered wallet: `importWallet` persists no accounts, so every
 * `createAccount(chainId, _, _, index)` call re-derives an index whose
 * on-chain status is fixed by `statusByIndex`. The mock persists the minted
 * account so subsequent `listAccounts` calls see it, exactly like libqc.
 */
const createRecoveredRepairVault = ({
  chainIdValue,
  supportedChains,
  statusByIndex,
  statusErrorByIndex = {},
  initialIndices
}: {
  chainIdValue: string;
  supportedChains: ReadonlyArray<{ chainId: ChainId }>;
  statusByIndex: ReadonlyArray<AccountStatus>;
  statusErrorByIndex?: Readonly<Record<number, Error>>;
  initialIndices: ReadonlyArray<number>;
}) => {
  const accounts: TestAccount[] = initialIndices.map(index =>
    createAccount(chainIdValue, `index-${index}`)
  );
  const indexByAccountId = new Map(
    initialIndices.map(index => [`${chainIdValue}:index-${index}`, index])
  );

  return {
    listAccounts: vi.fn(async () => [...accounts]),
    getSupportedChains: vi.fn(() => supportedChains),
    getAccount: vi.fn(async (accountId: TestPersistedAccountId) => ({
      getStatus: vi.fn(async () => {
        const index = indexByAccountId.get(accountId.toString());
        if (index === undefined) {
          throw new Error(`Unknown account ${accountId.toString()}`);
        }
        const statusError = statusErrorByIndex[index];
        if (statusError !== undefined) {
          throw statusError;
        }
        return statusByIndex[index] ?? 'safe';
      })
    })),
    createAccount: vi.fn(
      async (
        chainId: ChainId,
        _forceNewAddress?: boolean,
        _version?: unknown,
        addressIndex?: number
      ) => {
        const index = addressIndex ?? accounts.length;
        const account = createAccount(chainId.toString(), `index-${index}`);
        accounts.push(account);
        indexByAccountId.set(account.id.toString(), index);
        return undefined;
      }
    )
  };
};

describe('resolveSafeVaultRepairAction', () => {
  it('skips when at least one account on the chain is already safe', () => {
    expect(
      resolveSafeVaultRepairAction({
        chainAccountStatuses: [
          createStatusEntry('vulnerable'),
          createStatusEntry('safe')
        ],
        allAccounts: [
          createAccount(bitcoinMainnetChainId, '01'),
          createAccount(bitcoinMainnetChainId, '02')
        ],
        chainId: createChainId(bitcoinMainnetChainId)
      })
    ).toEqual({ kind: 'skip' });
  });

  it('skips when the chain has no persisted accounts', () => {
    expect(
      resolveSafeVaultRepairAction({
        chainAccountStatuses: [],
        allAccounts: [createAccount(ethereumChainId, '01')],
        chainId: createChainId(bitcoinMainnetChainId)
      })
    ).toEqual({ kind: 'skip' });
  });

  it('creates at the next Bitcoin index when every BTC account is vulnerable', () => {
    expect(
      resolveSafeVaultRepairAction({
        chainAccountStatuses: [createStatusEntry('vulnerable')],
        allAccounts: [
          createAccount(bitcoinMainnetChainId, '01'),
          createAccount(ethereumChainId, '01')
        ],
        chainId: createChainId(bitcoinMainnetChainId)
      })
    ).toEqual({ kind: 'create', addressIndex: 1 });
  });

  it('advances the Bitcoin index when multiple vulnerable BTC accounts already exist', () => {
    expect(
      resolveSafeVaultRepairAction({
        chainAccountStatuses: [
          createStatusEntry('vulnerable'),
          createStatusEntry('vulnerable')
        ],
        allAccounts: [
          createAccount(bitcoinMainnetChainId, '01'),
          createAccount(bitcoinMainnetChainId, '02')
        ],
        chainId: createChainId(bitcoinMainnetChainId)
      })
    ).toEqual({ kind: 'create', addressIndex: 2 });
  });

  it('creates with undefined index for EVM when every EVM account is vulnerable', () => {
    expect(
      resolveSafeVaultRepairAction({
        chainAccountStatuses: [createStatusEntry('vulnerable')],
        allAccounts: [createAccount(ethereumChainId, '01')],
        chainId: createChainId(ethereumChainId)
      })
    ).toEqual({ kind: 'create', addressIndex: undefined });
  });
});

describe('getDefaultChainGroupsToInspect', () => {
  it('returns one group per default chain that has at least one persisted account', () => {
    const accounts = [
      createAccount(bitcoinMainnetChainId, '01'),
      createAccount(ethereumChainId, '01'),
      createAccount(ethereumChainId, '02')
    ];
    const supportedChains = [
      { chainId: createChainId(bitcoinMainnetChainId) },
      { chainId: createChainId(ethereumChainId) }
    ];

    const groups = getDefaultChainGroupsToInspect({
      accounts,
      supportedChains
    });

    expect(groups).toHaveLength(2);
    expect(groups[0].chainId.toString()).toBe(bitcoinMainnetChainId);
    expect(groups[0].accountsOnChain).toHaveLength(1);
    expect(groups[1].chainId.toString()).toBe(ethereumChainId);
    expect(groups[1].accountsOnChain).toHaveLength(2);
  });

  it('omits default chains that have no persisted accounts (left to the missing-default-chain repair branch)', () => {
    const accounts = [createAccount(bitcoinMainnetChainId, '01')];
    const supportedChains = [
      { chainId: createChainId(bitcoinMainnetChainId) },
      { chainId: createChainId(ethereumChainId) }
    ];

    const groups = getDefaultChainGroupsToInspect({
      accounts,
      supportedChains
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].chainId.toString()).toBe(bitcoinMainnetChainId);
  });

  it('ignores accounts on non-default chains', () => {
    const accounts = [
      createAccount(bitcoinMainnetChainId, '01'),
      createAccount(unsupportedChainId, '01')
    ];
    const supportedChains = [
      { chainId: createChainId(bitcoinMainnetChainId) },
      { chainId: createChainId(ethereumChainId) }
    ];

    const groups = getDefaultChainGroupsToInspect({
      accounts,
      supportedChains
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].chainId.toString()).toBe(bitcoinMainnetChainId);
  });

  it('throws when a configured default chain is missing from supported chains', () => {
    expect(() =>
      getDefaultChainGroupsToInspect({
        accounts: [createAccount(bitcoinMainnetChainId, '01')],
        supportedChains: [{ chainId: createChainId(bitcoinMainnetChainId) }]
      })
    ).toThrow(
      `Expected supported default account chain ${ethereumChainId} to be present`
    );
  });
});

describe('repairUnsafeDefaultAccounts', () => {
  it('creates one replacement for an all-vulnerable default Bitcoin chain', async () => {
    const bitcoinChain = createChainId(bitcoinMainnetChainId);
    const ethereumChain = createChainId(ethereumChainId);
    const bitcoinAccount = createAccount(bitcoinMainnetChainId, '01');
    const vault = createRepairVault({
      accounts: [bitcoinAccount],
      supportedChains: [{ chainId: bitcoinChain }, { chainId: ethereumChain }],
      statusesByAccountId: {
        [bitcoinAccount.id.toString()]: 'vulnerable'
      }
    });

    await expect(repairUnsafeDefaultAccounts({ vault })).resolves.toBe(1);
    expect(vault.createAccount).toHaveBeenCalledTimes(1);
    expect(vault.createAccount).toHaveBeenCalledWith(
      bitcoinChain,
      undefined,
      undefined,
      1
    );
  });

  it('skips default chains that already have a safe account', async () => {
    const bitcoinAccount = createAccount(bitcoinMainnetChainId, '01');
    const vault = createRepairVault({
      accounts: [bitcoinAccount],
      supportedChains: [
        { chainId: createChainId(bitcoinMainnetChainId) },
        { chainId: createChainId(ethereumChainId) }
      ],
      statusesByAccountId: {
        [bitcoinAccount.id.toString()]: 'safe'
      }
    });

    await expect(repairUnsafeDefaultAccounts({ vault })).resolves.toBe(0);
    expect(vault.createAccount).not.toHaveBeenCalled();
  });

  it('does not block repair when status inspection fails', async () => {
    const bitcoinChain = createChainId(bitcoinMainnetChainId);
    const bitcoinAccount = createAccount(bitcoinMainnetChainId, '01');
    const statusError = new Error('status unavailable');
    const onRepairWarning = vi.fn();
    const vault = createRepairVault({
      accounts: [bitcoinAccount],
      supportedChains: [
        { chainId: bitcoinChain },
        { chainId: createChainId(ethereumChainId) }
      ],
      statusesByAccountId: {},
      statusErrorByAccountId: {
        [bitcoinAccount.id.toString()]: statusError
      }
    });

    await expect(
      repairUnsafeDefaultAccounts({ vault, onRepairWarning })
    ).resolves.toBe(0);
    expect(vault.createAccount).not.toHaveBeenCalled();
    expect(onRepairWarning).toHaveBeenCalledTimes(1);
    expect(onRepairWarning).toHaveBeenCalledWith({
      chainId: bitcoinChain,
      error: statusError,
      kind: 'status-inspection-failed'
    });
  });

  it('does not block repair when replacement creation fails', async () => {
    const bitcoinChain = createChainId(bitcoinMainnetChainId);
    const bitcoinAccount = createAccount(bitcoinMainnetChainId, '01');
    const createError = new Error('create failed');
    const onRepairWarning = vi.fn();
    const vault = createRepairVault({
      accounts: [bitcoinAccount],
      supportedChains: [
        { chainId: bitcoinChain },
        { chainId: createChainId(ethereumChainId) }
      ],
      statusesByAccountId: {
        [bitcoinAccount.id.toString()]: 'vulnerable'
      },
      createAccount: vi.fn(async () => {
        throw createError;
      })
    });

    await expect(
      repairUnsafeDefaultAccounts({ vault, onRepairWarning })
    ).resolves.toBe(0);
    expect(onRepairWarning).toHaveBeenCalledTimes(1);
    expect(onRepairWarning).toHaveBeenCalledWith({
      chainId: bitcoinChain,
      error: createError,
      kind: 'account-creation-failed'
    });
  });

  it('rediscovers every rotated vault of a recovered wallet in a single pass', async () => {
    // Recovered wallet: index 0 restored by the missing-chain branch. On
    // chain, indices 0-2 were each drained by an earlier rotation and index
    // 3 holds the funds and has never signed.
    const bitcoinChain = createChainId(bitcoinMainnetChainId);
    const vault = createRecoveredRepairVault({
      chainIdValue: bitcoinMainnetChainId,
      supportedChains: [
        { chainId: bitcoinChain },
        { chainId: createChainId(ethereumChainId) }
      ],
      statusByIndex: ['vulnerable', 'vulnerable', 'vulnerable', 'safe'],
      initialIndices: [0]
    });

    await expect(repairUnsafeDefaultAccounts({ vault })).resolves.toBe(3);
    expect(vault.createAccount.mock.calls.map(call => call[3])).toEqual([
      1, 2, 3
    ]);
  });

  it('stops after the first repair when the minted vault is safe', async () => {
    const bitcoinChain = createChainId(bitcoinMainnetChainId);
    const vault = createRecoveredRepairVault({
      chainIdValue: bitcoinMainnetChainId,
      supportedChains: [
        { chainId: bitcoinChain },
        { chainId: createChainId(ethereumChainId) }
      ],
      statusByIndex: ['vulnerable', 'safe'],
      initialIndices: [0]
    });

    await expect(repairUnsafeDefaultAccounts({ vault })).resolves.toBe(1);
    expect(vault.createAccount).toHaveBeenCalledTimes(1);
  });

  it('caps chained repairs per chain when every minted vault keeps reporting vulnerable', async () => {
    const bitcoinChain = createChainId(bitcoinMainnetChainId);
    const vault = createRecoveredRepairVault({
      chainIdValue: bitcoinMainnetChainId,
      supportedChains: [
        { chainId: bitcoinChain },
        { chainId: createChainId(ethereumChainId) }
      ],
      statusByIndex: Array.from(
        { length: maxSafeVaultRepairsPerChain + 5 },
        () => 'vulnerable' as const
      ),
      initialIndices: [0]
    });

    await expect(repairUnsafeDefaultAccounts({ vault })).resolves.toBe(
      maxSafeVaultRepairsPerChain
    );
  });

  it('stops chaining and warns when the minted vault status cannot be inspected', async () => {
    const bitcoinChain = createChainId(bitcoinMainnetChainId);
    const onRepairWarning = vi.fn();
    const vault = createRecoveredRepairVault({
      chainIdValue: bitcoinMainnetChainId,
      supportedChains: [
        { chainId: bitcoinChain },
        { chainId: createChainId(ethereumChainId) }
      ],
      statusByIndex: ['vulnerable'],
      statusErrorByIndex: { 1: new Error('status unavailable') },
      initialIndices: [0]
    });

    await expect(
      repairUnsafeDefaultAccounts({ vault, onRepairWarning })
    ).resolves.toBe(1);
    expect(vault.createAccount).toHaveBeenCalledTimes(1);
    expect(onRepairWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: bitcoinChain,
        kind: 'status-inspection-failed'
      })
    );
  });
});
