import { describe, expect, it } from 'vitest';

import {
  isWithdrawalLifecycleKind,
  vaultLifecycleKinds,
  type VaultLifecycleKind
} from './core';

describe('vault lifecycle core', () => {
  describe('isWithdrawalLifecycleKind', () => {
    const cases: ReadonlyArray<{
      lifecycleKind: VaultLifecycleKind;
      expected: boolean;
    }> = [
      { lifecycleKind: 'safe', expected: false },
      { lifecycleKind: 'vulnerable', expected: false },
      { lifecycleKind: 'pending', expected: true },
      { lifecycleKind: 'sent', expected: true },
      { lifecycleKind: 'withdrawn', expected: true }
    ];

    it.each(cases)(
      'returns $expected for the $lifecycleKind lifecycle kind',
      ({ lifecycleKind, expected }) => {
        expect(isWithdrawalLifecycleKind(lifecycleKind)).toBe(expected);
      }
    );

    it('covers every lifecycle kind in the union', () => {
      // Drift guard: adding a new kind to `vaultLifecycleKinds` must force
      // an explicit classification decision in the `cases` table above.
      // Without this assertion the table can silently fall behind the union.
      const sortByName = (kinds: ReadonlyArray<VaultLifecycleKind>) =>
        [...kinds].sort();
      expect(
        sortByName(cases.map(({ lifecycleKind }) => lifecycleKind))
      ).toEqual(sortByName(vaultLifecycleKinds));
    });
  });
});
