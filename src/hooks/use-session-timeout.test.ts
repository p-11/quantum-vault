import { sessionTimeoutMs } from '@/lib/session';
import type { ScreenKey } from '@/screens';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createSessionTimeoutController,
  shouldTrackSessionForScreen,
  vaultSessionStateChangedEventName
} from './use-session-timeout';

const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];

type SetupSessionTimeoutControllerInput = {
  activeScreen?: ScreenKey;
  isVaultUnlocked?: () => boolean;
};

const setupSessionTimeoutController = ({
  activeScreen = 'export-recovery-phrase',
  isVaultUnlocked = () => true
}: SetupSessionTimeoutControllerInput = {}) => {
  const eventTarget = new EventTarget();
  const onTimeout = vi.fn();
  const controller = createSessionTimeoutController({
    activeScreen,
    eventTarget,
    isVaultUnlocked,
    onTimeout
  });

  return {
    controller,
    eventTarget,
    onTimeout
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('shouldTrackSessionForScreen', () => {
  it('always tracks session on export recovery phrase screen', () => {
    expect(
      shouldTrackSessionForScreen({
        activeScreen: 'export-recovery-phrase',
        isVaultUnlocked: false
      })
    ).toBe(true);
    expect(
      shouldTrackSessionForScreen({
        activeScreen: 'export-recovery-phrase',
        isVaultUnlocked: true
      })
    ).toBe(true);
  });

  it('tracks session on wallet creation only when vault is unlocked', () => {
    expect(
      shouldTrackSessionForScreen({
        activeScreen: 'wallet-creation',
        isVaultUnlocked: false
      })
    ).toBe(false);
    expect(
      shouldTrackSessionForScreen({
        activeScreen: 'wallet-creation',
        isVaultUnlocked: true
      })
    ).toBe(true);
  });

  it('never tracks session on lock screen', () => {
    expect(
      shouldTrackSessionForScreen({
        activeScreen: 'lock',
        isVaultUnlocked: false
      })
    ).toBe(false);
  });
});

describe('createSessionTimeoutController', () => {
  it('fires timeout for export recovery phrase after inactivity', () => {
    vi.useFakeTimers();
    const { onTimeout } = setupSessionTimeoutController();

    vi.advanceTimersByTime(sessionTimeoutMs - 1);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('resets timeout on each tracked activity event', () => {
    vi.useFakeTimers();

    for (const eventName of activityEvents) {
      const { controller, eventTarget, onTimeout } =
        setupSessionTimeoutController();

      vi.advanceTimersByTime(sessionTimeoutMs - 1);
      eventTarget.dispatchEvent(new Event(eventName));
      vi.advanceTimersByTime(sessionTimeoutMs - 1);
      expect(onTimeout).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onTimeout).toHaveBeenCalledTimes(1);
      controller.dispose();
    }
  });

  it('starts wallet creation timeout only after unlocked session notification', () => {
    vi.useFakeTimers();
    let isUnlocked = false;
    const { eventTarget, onTimeout } = setupSessionTimeoutController({
      activeScreen: 'wallet-creation',
      isVaultUnlocked: () => isUnlocked
    });

    vi.advanceTimersByTime(sessionTimeoutMs);
    expect(onTimeout).not.toHaveBeenCalled();

    isUnlocked = true;
    eventTarget.dispatchEvent(new Event(vaultSessionStateChangedEventName));
    vi.advanceTimersByTime(sessionTimeoutMs - 1);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending timeout on cleanup', () => {
    vi.useFakeTimers();
    const { controller, onTimeout } = setupSessionTimeoutController();

    controller.dispose();
    vi.advanceTimersByTime(sessionTimeoutMs);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
