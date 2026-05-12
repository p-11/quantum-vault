import type { RefObject } from 'react';
import type { PasswordValidationResult } from '@project-eleven/libqc';
import { useState } from 'react';

import { PasswordRevealToggle } from '@/components/shared/password-reveal-toggle';
import { Field } from '@/components/ui/field';
import { useBoolean } from '@/hooks/use-boolean';
import {
  getDisplayedInlineError,
  getPasswordConfirmationErrorOnBlur,
  getPasswordErrorOnBlur
} from './password-form-validation';

type PasswordFormProps = {
  passwordsMatch: boolean;
  passwordValidation: PasswordValidationResult;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onSubmit?: () => void;
  passwordInputRef?: RefObject<HTMLInputElement | null>;
  passwordConfirmationInputRef?: RefObject<HTMLInputElement | null>;
};

/**
 * Password + confirm-password pair used by every new-password flow (wallet
 * creation, wallet recovery). Inputs stay uncontrolled to avoid duplicating
 * plaintext secrets in React state; feature hooks keep mutable byte refs and
 * expose only derived metadata needed for UI validation/error timing.
 */
export const PasswordForm = ({
  passwordsMatch,
  passwordValidation,
  onPasswordChange,
  onPasswordConfirmationChange,
  onSubmit,
  passwordInputRef,
  passwordConfirmationInputRef
}: PasswordFormProps) => {
  const [isPasswordRevealed, passwordReveal] = useBoolean();
  const [isConfirmRevealed, confirmReveal] = useBoolean();
  const [isPasswordTouched, passwordTouched] = useBoolean();
  const [isConfirmTouched, confirmTouched] = useBoolean();
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmFocused, setIsConfirmFocused] = useState(false);
  const [hasPasswordInput, setHasPasswordInput] = useState(false);
  const [hasPasswordConfirmationInput, setHasPasswordConfirmationInput] =
    useState(false);
  const [passwordErrorOnBlur, setPasswordErrorOnBlur] = useState<
    string | undefined
  >();
  const [confirmErrorOnBlur, setConfirmErrorOnBlur] = useState<
    string | undefined
  >();

  const handlePasswordChange = (value: string) => {
    setHasPasswordInput(value.length > 0);
    onPasswordChange(value);
  };

  const handlePasswordConfirmationChange = (value: string) => {
    setHasPasswordConfirmationInput(value.length > 0);
    onPasswordConfirmationChange(value);
  };

  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
    passwordTouched.set();
    setPasswordErrorOnBlur(
      getPasswordErrorOnBlur({
        hasPassword: hasPasswordInput,
        failedRequirements: passwordValidation.failedRequirements
      })
    );
  };

  const handleConfirmBlur = () => {
    setIsConfirmFocused(false);
    confirmTouched.set();
    setConfirmErrorOnBlur(
      getPasswordConfirmationErrorOnBlur({
        hasPasswordConfirmation: hasPasswordConfirmationInput,
        passwordsMatch
      })
    );
  };

  const passwordError = getDisplayedInlineError({
    isTouched: isPasswordTouched,
    isFocused: isPasswordFocused,
    hasValue: hasPasswordInput,
    blurError: passwordErrorOnBlur
  });

  const confirmError = getDisplayedInlineError({
    isTouched: isConfirmTouched,
    isFocused: isConfirmFocused,
    hasValue: hasPasswordConfirmationInput,
    blurError: confirmErrorOnBlur
  });

  return (
    <div className='flex flex-col gap-4'>
      <Field
        label='Password'
        type={isPasswordRevealed ? 'text' : 'password'}
        onChange={handlePasswordChange}
        onBlur={handlePasswordBlur}
        onFocus={() => setIsPasswordFocused(true)}
        placeholder='Create a password'
        autoFocus
        autoComplete='new-password'
        error={passwordError}
        inputRef={passwordInputRef}
        trailingAddon={
          <PasswordRevealToggle
            isRevealed={isPasswordRevealed}
            onToggle={passwordReveal.toggle}
          />
        }
      />
      <Field
        label='Confirm Password'
        type={isConfirmRevealed ? 'text' : 'password'}
        onChange={handlePasswordConfirmationChange}
        onBlur={handleConfirmBlur}
        onFocus={() => setIsConfirmFocused(true)}
        placeholder='Confirm password'
        autoComplete='new-password'
        onSubmit={onSubmit}
        error={confirmError}
        inputRef={passwordConfirmationInputRef}
        trailingAddon={
          <PasswordRevealToggle
            isRevealed={isConfirmRevealed}
            onToggle={confirmReveal.toggle}
          />
        }
      />
    </div>
  );
};
