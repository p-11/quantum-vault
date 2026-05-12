import { describe, expect, it, vi } from 'vitest';
import type { ChainId } from '@project-eleven/libqc';

// libqc's published ESM bundle uses extensionless imports that Vitest cannot
// resolve under Node's strict ESM loader. The helper only needs the
// `isBitcoinChain` predicate from libqc, so we mock that surface and keep the
// test runtime self-contained. The mock mirrors libqc's actual definition:
// a Bitcoin chain is any chain whose CAIP-2 namespace is `bip122`.
vi.mock('@project-eleven/libqc', () => ({
  isBitcoinChain: (chainId: { namespace: string }) =>
    chainId.namespace === 'bip122'
}));

import {
  resolveReplacementVaultAction,
  type ReplacementAccountStatus
} from './replacement-account';

type TestAccount = {
  id: { toString(): string };
  chainId: ChainId;
  status: ReplacementAccountStatus | 'unknown';
};

const bitcoinMainnetChainId = 'bip122:000000000019d6689c085ae165831e93';
const bitcoinTestnetChainId = 'bip122:000000000933ea01ad0ee984209779ba';
const ethereumChainId = 'eip155:1';
const polygonChainId = 'eip155:137';

const ownedSafeAccountId = `${ethereumChainId}:0xabc`;

const createChainId = (value: string): ChainId => {
  const [namespace, reference] = value.split(':');

  return {
    namespace,
    reference,
    toString: () => value,
    toJSON: () => ({ namespace, reference })
  };
};

const createAccount = ({
  chainId,
  idSuffix,
  status = 'safe'
}: {
  chainId: string;
  idSuffix: string;
  status?: ReplacementAccountStatus | 'unknown';
}): TestAccount => ({
  id: { toString: () => `${chainId}:${idSuffix}` },
  chainId: createChainId(chainId),
  status
});

describe('resolveReplacementVaultAction', () => {
  it('skips when destination is an owned account on the same Bitcoin chain', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({ chainId: bitcoinMainnetChainId, idSuffix: '01' })
        ],
        sourceChainId: createChainId(bitcoinMainnetChainId),
        sourceAccountId: `${bitcoinMainnetChainId}:01`,
        ownedDestinationAccountId: ownedSafeAccountId
      })
    ).toEqual({ kind: 'skip' });
  });

  it('skips when destination is an owned account on the same EVM chain', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [createAccount({ chainId: ethereumChainId, idSuffix: '01' })],
        sourceChainId: createChainId(ethereumChainId),
        sourceAccountId: `${ethereumChainId}:01`,
        ownedDestinationAccountId: ownedSafeAccountId
      })
    ).toEqual({ kind: 'skip' });
  });

  it('creates at index 0 for Bitcoin when no accounts exist and destination is external', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [],
        sourceChainId: createChainId(bitcoinMainnetChainId),
        sourceAccountId: `${bitcoinMainnetChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'create', addressIndex: 0 });
  });

  it('creates at the next free index for Bitcoin when same-chain accounts exist', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({ chainId: ethereumChainId, idSuffix: '01' }),
          createAccount({ chainId: bitcoinTestnetChainId, idSuffix: '01' }),
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '01',
            status: 'vulnerable'
          })
        ],
        sourceChainId: createChainId(bitcoinMainnetChainId),
        sourceAccountId: `${bitcoinMainnetChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'create', addressIndex: 1 });
  });

  it('advances the Bitcoin index across multiple rotations', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '01',
            status: 'vulnerable'
          }),
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '02',
            status: 'vulnerable'
          })
        ],
        sourceChainId: createChainId(bitcoinMainnetChainId),
        sourceAccountId: `${bitcoinMainnetChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'create', addressIndex: 2 });
  });

  it('creates with undefined index for EVM and lets libqc advance', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({
            chainId: ethereumChainId,
            idSuffix: '01',
            status: 'vulnerable'
          })
        ],
        sourceChainId: createChainId(ethereumChainId),
        sourceAccountId: `${ethereumChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'create', addressIndex: undefined });

    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({
            chainId: ethereumChainId,
            idSuffix: '01',
            status: 'vulnerable'
          }),
          createAccount({
            chainId: polygonChainId,
            idSuffix: '01',
            status: 'vulnerable'
          })
        ],
        sourceChainId: createChainId(polygonChainId),
        sourceAccountId: `${polygonChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'create', addressIndex: undefined });
  });

  it('skips external-destination rotation when another same-chain account is already safe', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '01',
            status: 'vulnerable'
          }),
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '02',
            status: 'safe'
          })
        ],
        sourceChainId: createChainId(bitcoinMainnetChainId),
        sourceAccountId: `${bitcoinMainnetChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'skip' });
  });

  it('skips external-destination rotation when another same-chain account status is unknown', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '01',
            status: 'vulnerable'
          }),
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '02',
            status: 'unknown'
          })
        ],
        sourceChainId: createChainId(bitcoinMainnetChainId),
        sourceAccountId: `${bitcoinMainnetChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'skip' });
  });

  it('does not treat the source account as the replacement even when it is currently safe', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '01',
            status: 'safe'
          })
        ],
        sourceChainId: createChainId(bitcoinMainnetChainId),
        sourceAccountId: `${bitcoinMainnetChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'create', addressIndex: 1 });
  });

  it('does not treat unknown source account status as an existing replacement', () => {
    expect(
      resolveReplacementVaultAction({
        accounts: [
          createAccount({
            chainId: bitcoinMainnetChainId,
            idSuffix: '01',
            status: 'unknown'
          })
        ],
        sourceChainId: createChainId(bitcoinMainnetChainId),
        sourceAccountId: `${bitcoinMainnetChainId}:01`,
        ownedDestinationAccountId: undefined
      })
    ).toEqual({ kind: 'create', addressIndex: 1 });
  });
});
