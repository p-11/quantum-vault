import { providerQueryKeys } from '@/providers/query-keys';

describe('providerQueryKeys', () => {
  const baseScope = {
    sessionId: 7,
    currency: 'usd' as const,
    mode: 'inventory-only' as const
  };

  it('returns stable key values for repeated calls with identical input', () => {
    expect(providerQueryKeys.boot()).toEqual(providerQueryKeys.boot());
    expect(providerQueryKeys.summary(baseScope)).toEqual(
      providerQueryKeys.summary(baseScope)
    );
  });

  it('uses session id to scope non-boot provider queries', () => {
    const currentSession = {
      sessionId: 1,
      currency: 'usd' as const,
      mode: 'inventory-only' as const
    };
    const nextSession = {
      sessionId: 2,
      currency: 'usd' as const,
      mode: 'inventory-only' as const
    };

    expect(providerQueryKeys.summary(currentSession)).not.toEqual(
      providerQueryKeys.summary(nextSession)
    );
  });

  it('uses mode to isolate wallet summary cache', () => {
    expect(
      providerQueryKeys.summary({
        sessionId: baseScope.sessionId,
        currency: baseScope.currency,
        mode: 'full'
      })
    ).not.toEqual(providerQueryKeys.summary(baseScope));
  });
});
