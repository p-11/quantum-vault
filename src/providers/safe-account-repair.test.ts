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
});
