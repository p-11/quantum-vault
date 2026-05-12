import { describe, expect, it } from 'vitest';

import { assertWithdrawalResultIdentity } from './withdrawal-result';

const accountId = 'eip155:1:0x1111111111111111111111111111111111111111';
const chainId = 'eip155:1';

const selectedAccount = {
  id: {
    toString: () => accountId
  },
  chainId: {
    toString: () => chainId
  }
};

const createResult = () => ({
  accountId,
  destinationChain: chainId,
  status: 'pending' as const
});

describe('withdrawal-result', () => {
  describe('assertWithdrawalResultIdentity', () => {
    it('accepts responses that match the selected account identity', () => {
      expect(() =>
        assertWithdrawalResultIdentity({
          result: createResult(),
          selectedAccount
        })
      ).not.toThrow();
    });

    it('throws when account id mismatches', () => {
      expect(() =>
        assertWithdrawalResultIdentity({
          result: {
            ...createResult(),
            accountId: 'eip155:1:0x3333333333333333333333333333333333333333'
          },
          selectedAccount
        })
      ).toThrow(
        `Withdrawal account mismatch: expected ${accountId}, got eip155:1:0x3333333333333333333333333333333333333333`
      );
    });

    it('throws when destination chain mismatches', () => {
      expect(() =>
        assertWithdrawalResultIdentity({
          result: {
            ...createResult(),
            destinationChain: 'bip122:000000000019d6689c085ae165831e93'
          },
          selectedAccount
        })
      ).toThrow(
        'Withdrawal chain mismatch: expected eip155:1, got bip122:000000000019d6689c085ae165831e93'
      );
    });
  });
});
