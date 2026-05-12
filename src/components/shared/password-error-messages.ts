import type { PasswordRequirementId } from '@project-eleven/libqc';

/**
 * Inline error copy keyed by libqc's `PasswordRequirementId`. Figma 12:7611
 * shows only the `minLength` failure as an inline error below the password
 * field, but the full set is mapped here so any failed requirement renders
 * descriptive copy without surfacing the entire checklist. The first entry of
 * `failedRequirements` is what libqc surfaces first, so `getPasswordErrorMessage`
 * returns that mapping.
 */
const passwordErrorMessages = {
  minLength: 'Password is too short. Use at least 8 characters.',
  uppercase: 'Add at least one uppercase letter.',
  lowercase: 'Add at least one lowercase letter.',
  digit: 'Add at least one number.',
  specialChar: 'Add at least one special character.',
  asciiOnly: 'Use only printable standard ASCII characters.'
} as const satisfies Record<PasswordRequirementId, string>;

export const getPasswordErrorMessage = (
  failedRequirements: readonly PasswordRequirementId[]
): string | undefined => {
  const [first] = failedRequirements;
  return first ? passwordErrorMessages[first] : undefined;
};
