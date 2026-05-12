import {
  InvalidPasswordFormatError,
  Password as LibQCPassword,
  validatePassword,
  type Password
} from '@project-eleven/libqc';

const nonEmptyPasswordLength = 1;

export const toValidatedNewPasswordBytes = (
  passwordBytes: Uint8Array
): Password => {
  const validation = validatePassword(passwordBytes);
  if (!validation.valid) {
    throw new InvalidPasswordFormatError(
      `Failed requirements: ${validation.failedRequirements.join(', ')}`
    );
  }

  return LibQCPassword.from(passwordBytes);
};

export const toExistingVaultPasswordBytes = (
  passwordBytes: Uint8Array
): Password => {
  if (passwordBytes.length < nonEmptyPasswordLength) {
    throw new InvalidPasswordFormatError('Password is required');
  }

  return LibQCPassword.from(passwordBytes);
};
