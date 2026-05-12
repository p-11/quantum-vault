import { vaultQueryKeys } from '@/modules/vaults/data/query-keys';

describe('vaultQueryKeys', () => {
  const baseScope = {
    sessionId: 7,
    accountId: 'account-1',
    currency: 'usd' as const
  };

  it('returns stable key values for repeated calls with identical input', () => {
    expect(
      vaultQueryKeys.snapshots({ ...baseScope, accountIdsKey: '1,2,3' })
    ).toEqual(
      vaultQueryKeys.snapshots({ ...baseScope, accountIdsKey: '1,2,3' })
    );
    expect(vaultQueryKeys.accountData(baseScope)).toEqual(
      vaultQueryKeys.accountData(baseScope)
    );
    expect(
      vaultQueryKeys.accountActivities({
        accountId: baseScope.accountId,
        sessionId: baseScope.sessionId
      })
    ).toEqual(
      vaultQueryKeys.accountActivities({
        accountId: baseScope.accountId,
        sessionId: baseScope.sessionId
      })
    );
    expect(vaultQueryKeys.vaultDetail(baseScope)).toEqual(
      vaultQueryKeys.vaultDetail(baseScope)
    );
    expect(vaultQueryKeys.snapshotsScope(baseScope)).toEqual(
      vaultQueryKeys.snapshotsScope(baseScope)
    );
    expect(
      vaultQueryKeys.accountDataScope({ sessionId: baseScope.sessionId })
    ).toEqual(
      vaultQueryKeys.accountDataScope({ sessionId: baseScope.sessionId })
    );
    expect(
      vaultQueryKeys.accountActivitiesScope({ sessionId: baseScope.sessionId })
    ).toEqual(
      vaultQueryKeys.accountActivitiesScope({ sessionId: baseScope.sessionId })
    );
    expect(
      vaultQueryKeys.vaultDetailScope({ sessionId: baseScope.sessionId })
    ).toEqual(
      vaultQueryKeys.vaultDetailScope({ sessionId: baseScope.sessionId })
    );
  });

  it('uses session id to scope vault queries', () => {
    const currentSession = {
      sessionId: 1,
      accountId: 'account-1',
      currency: 'usd' as const
    };
    const nextSession = {
      sessionId: 2,
      accountId: 'account-1',
      currency: 'usd' as const
    };

    expect(
      vaultQueryKeys.snapshots({
        ...currentSession,
        accountIdsKey: 'account-1'
      })
    ).not.toEqual(
      vaultQueryKeys.snapshots({
        ...nextSession,
        accountIdsKey: 'account-1'
      })
    );
    expect(vaultQueryKeys.accountData(currentSession)).not.toEqual(
      vaultQueryKeys.accountData(nextSession)
    );
    expect(
      vaultQueryKeys.accountActivities({
        sessionId: currentSession.sessionId,
        accountId: currentSession.accountId
      })
    ).not.toEqual(
      vaultQueryKeys.accountActivities({
        sessionId: nextSession.sessionId,
        accountId: nextSession.accountId
      })
    );
    expect(vaultQueryKeys.vaultDetail(currentSession)).not.toEqual(
      vaultQueryKeys.vaultDetail(nextSession)
    );
    expect(vaultQueryKeys.snapshotsScope(currentSession)).not.toEqual(
      vaultQueryKeys.snapshotsScope(nextSession)
    );
    expect(
      vaultQueryKeys.accountDataScope({ sessionId: currentSession.sessionId })
    ).not.toEqual(
      vaultQueryKeys.accountDataScope({ sessionId: nextSession.sessionId })
    );
    expect(
      vaultQueryKeys.accountActivitiesScope({
        sessionId: currentSession.sessionId
      })
    ).not.toEqual(
      vaultQueryKeys.accountActivitiesScope({
        sessionId: nextSession.sessionId
      })
    );
    expect(
      vaultQueryKeys.vaultDetailScope({ sessionId: currentSession.sessionId })
    ).not.toEqual(
      vaultQueryKeys.vaultDetailScope({ sessionId: nextSession.sessionId })
    );
  });

  it('allows undefined account ids in account-scoped keys', () => {
    expect(
      vaultQueryKeys.accountData({
        sessionId: baseScope.sessionId,
        accountId: undefined,
        currency: baseScope.currency
      })
    ).toEqual([
      'quantum-vault',
      'account-data',
      baseScope.sessionId,
      undefined,
      baseScope.currency
    ]);
    expect(
      vaultQueryKeys.accountActivities({
        sessionId: baseScope.sessionId,
        accountId: undefined
      })
    ).toEqual([
      'quantum-vault',
      'account-activities',
      baseScope.sessionId,
      undefined
    ]);
  });
});
