import { describe, expect, it } from 'vitest';

import { resolveHydrationScreen } from './screen-provider-core';

describe('resolveHydrationScreen', () => {
  it('routes no-password users to onboarding when onboarding is unseen', () => {
    const result = resolveHydrationScreen({
      hydrationState: { kind: 'no-password' },
      isOnboardingSeen: false
    });

    expect(result).toBe('onboarding');
  });

  it('routes no-password users to initial when onboarding is already seen', () => {
    const result = resolveHydrationScreen({
      hydrationState: { kind: 'no-password' },
      isOnboardingSeen: true
    });

    expect(result).toBe('initial');
  });

  it('routes locked hydration state to lock', () => {
    const result = resolveHydrationScreen({
      hydrationState: { kind: 'locked' },
      isOnboardingSeen: true
    });

    expect(result).toBe('lock');
  });

  it('routes unlocked ready and degraded states to home', () => {
    const readyResult = resolveHydrationScreen({
      hydrationState: { kind: 'unlocked', initWalletResult: 'ready' },
      isOnboardingSeen: true
    });
    const degradedResult = resolveHydrationScreen({
      hydrationState: { kind: 'unlocked', initWalletResult: 'degraded' },
      isOnboardingSeen: true
    });

    expect(readyResult).toBe('home');
    expect(degradedResult).toBe('home');
  });

  it('routes unlocked ignored state to lock', () => {
    const result = resolveHydrationScreen({
      hydrationState: { kind: 'unlocked', initWalletResult: 'ignored' },
      isOnboardingSeen: true
    });

    expect(result).toBe('lock');
  });
});
