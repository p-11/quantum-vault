import type { PasswordRequirementId } from '@project-eleven/libqc';

import { getPasswordErrorMessage } from './password-error-messages';

type GetPasswordErrorOnBlurInput = {
  hasPassword: boolean;
  failedRequirements: readonly PasswordRequirementId[];
};

export const getPasswordErrorOnBlur = ({
  hasPassword,
  failedRequirements
}: GetPasswordErrorOnBlurInput): string | undefined => {
  if (!hasPassword) {
    return undefined;
  }

  return getPasswordErrorMessage(failedRequirements);
};

type GetPasswordConfirmationErrorOnBlurInput = {
  hasPasswordConfirmation: boolean;
  passwordsMatch: boolean;
};

export const getPasswordConfirmationErrorOnBlur = ({
  hasPasswordConfirmation,
  passwordsMatch
}: GetPasswordConfirmationErrorOnBlurInput): string | undefined => {
  const hasConfirmation = hasPasswordConfirmation;
  const isMismatch = !passwordsMatch;

  if (!hasConfirmation || !isMismatch) {
    return undefined;
  }

  return 'Passwords do not match.';
};

type GetDisplayedInlineErrorInput = {
  isTouched: boolean;
  isFocused: boolean;
  hasValue: boolean;
  blurError: string | undefined;
};

export const getDisplayedInlineError = ({
  isTouched,
  isFocused,
  hasValue,
  blurError
}: GetDisplayedInlineErrorInput): string | undefined => {
  if (!isTouched || isFocused || !hasValue) {
    return undefined;
  }

  return blurError;
};
