import { describe, expect, it } from 'vitest';
import type { ChainId } from '@project-eleven/libqc';

import { getMissingDefaultAccountChains } from './default-accounts';

type TestChain = {
  label: string;
  chainId: ChainId;
};

type TestAccount = {
  chainId: ChainId;
};

const bitcoinChainId = 'bip122:000000000019d6689c085ae165831e93';
const ethereumChainId = 'eip155:1';
const polygonChainId = 'eip155:137';

const createChainId = (value: string): ChainId => {
  const [namespace, reference] = value.split(':');

  return {
    namespace,
    reference,
    toString: () => value,
    toJSON: () => ({ namespace, reference })
  };
};

const createChain = (chainId: string): TestChain => ({
  label: chainId,
  chainId: createChainId(chainId)
});

const createAccount = (chainId: string): TestAccount => ({
  chainId: createChainId(chainId)
});

describe('getMissingDefaultAccountChains', () => {
  it('returns Bitcoin and Ethereum when no default accounts exist', () => {
    const bitcoin = createChain(bitcoinChainId);
    const ethereum = createChain(ethereumChainId);

    const result = getMissingDefaultAccountChains({
      accounts: [],
      supportedChains: [bitcoin, ethereum]
    });

    expect(result).toEqual([bitcoin, ethereum]);
  });

  it('returns only Bitcoin when Ethereum already exists', () => {
    const bitcoin = createChain(bitcoinChainId);
    const ethereum = createChain(ethereumChainId);

    const result = getMissingDefaultAccountChains({
      accounts: [createAccount(ethereumChainId)],
      supportedChains: [bitcoin, ethereum]
    });

    expect(result).toEqual([bitcoin]);
  });

  it('returns nothing when Bitcoin and Ethereum already exist', () => {
    const bitcoin = createChain(bitcoinChainId);
    const ethereum = createChain(ethereumChainId);
    const polygon = createChain(polygonChainId);

    const result = getMissingDefaultAccountChains({
      accounts: [
        createAccount(ethereumChainId),
        createAccount(bitcoinChainId),
        createAccount(polygonChainId)
      ],
      supportedChains: [bitcoin, ethereum, polygon]
    });

    expect(result).toEqual([]);
  });

  it('fails fast when a missing default chain is unsupported', () => {
    const ethereum = createChain(ethereumChainId);

    expect(() =>
      getMissingDefaultAccountChains({
        accounts: [createAccount(ethereumChainId)],
        supportedChains: [ethereum]
      })
    ).toThrow(
      `Expected supported default account chain ${bitcoinChainId} to be present`
    );
  });
});
