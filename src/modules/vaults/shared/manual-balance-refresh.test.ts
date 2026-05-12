import { describe, expect, it, vi } from 'vitest';

import { executeManualBalanceRefresh } from './manual-balance-refresh';

describe('executeManualBalanceRefresh', () => {
  it('reports a successful manual refresh lifecycle', async () => {
    const refreshBalances = vi.fn(async () => undefined);
    const onRefreshStart = vi.fn();
    const onRefreshSuccess = vi.fn();
    const onRefreshError = vi.fn();
    const onRefreshComplete = vi.fn();

    await executeManualBalanceRefresh({
      refreshBalances,
      onRefreshStart,
      onRefreshSuccess,
      onRefreshError,
      onRefreshComplete
    });

    expect(refreshBalances).toHaveBeenCalledTimes(1);
    expect(onRefreshStart).toHaveBeenCalledTimes(1);
    expect(onRefreshComplete).toHaveBeenCalledTimes(1);
    expect(onRefreshSuccess).toHaveBeenCalledTimes(1);
    expect(onRefreshError).not.toHaveBeenCalled();
  });

  it('reports refresh failures without throwing', async () => {
    const refreshBalances = vi.fn(async () => {
      throw new Error('refresh failed');
    });
    const onRefreshStart = vi.fn();
    const onRefreshSuccess = vi.fn();
    const onRefreshError = vi.fn();
    const onRefreshComplete = vi.fn();

    await executeManualBalanceRefresh({
      refreshBalances,
      onRefreshStart,
      onRefreshSuccess,
      onRefreshError,
      onRefreshComplete
    });

    expect(refreshBalances).toHaveBeenCalledTimes(1);
    expect(onRefreshStart).toHaveBeenCalledTimes(1);
    expect(onRefreshComplete).toHaveBeenCalledTimes(1);
    expect(onRefreshError).toHaveBeenCalledTimes(1);
    expect(onRefreshSuccess).not.toHaveBeenCalled();
  });
});
