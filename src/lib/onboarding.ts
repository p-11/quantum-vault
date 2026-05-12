const onboardingSeenStorageKey = 'quantum-vault-onboarding-seen';
const seenOnboardingValue = '1';

export const hasSeenOnboarding = (): boolean =>
  localStorage.getItem(onboardingSeenStorageKey) === seenOnboardingValue;

export const markOnboardingSeen = (): void => {
  localStorage.setItem(onboardingSeenStorageKey, seenOnboardingValue);
};
