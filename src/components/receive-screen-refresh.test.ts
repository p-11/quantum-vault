import { describe, expect, it, vi } from 'vitest';

import { refreshBalancesOnReceiveExit } from './receive-screen-refresh';

describe('refreshBalancesOnReceiveExit', () => {
  it('refreshes balances when exiting receive screen', async () => {
    const refreshBalances = vi.fn(async () => undefined);
    const onRefreshError = vi.fn();

    await refreshBalancesOnReceiveExit({
      refreshBalances,
      onRefreshError
    });

    expect(refreshBalances).toHaveBeenCalledTimes(1);
    expect(onRefreshError).not.toHaveBeenCalled();
  });

  it('surfaces refresh failures through the provided error callback', async () => {
    const refreshBalances = vi.fn(async () => {
      throw new Error('refresh failed');
    });
    const onRefreshError = vi.fn();

    await refreshBalancesOnReceiveExit({
      refreshBalances,
      onRefreshError
    });

    expect(refreshBalances).toHaveBeenCalledTimes(1);
    expect(onRefreshError).toHaveBeenCalledTimes(1);
  });
});
