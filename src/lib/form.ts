import type { FormEvent, KeyboardEvent } from 'react';

type GetFormPropsInput = {
  onClose?: () => void;
  onSubmit?: () => void;
  isDisabled?: boolean;
  isPending?: boolean;
};

export const getFormProps = ({
  onClose,
  onSubmit,
  isDisabled,
  isPending
}: GetFormPropsInput) => ({
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose?.();
    }
  },
  onSubmit: (e: FormEvent) => {
    e.preventDefault();
    if (isDisabled || isPending) return;
    onSubmit?.();
  }
});

export const preventDefault =
  <E extends { preventDefault: () => void }>(handler?: (e: E) => void) =>
  (e: E) => {
    e.preventDefault();
    handler?.(e);
  };

export const stopPropagation =
  <E extends { stopPropagation: () => void }>(handler?: (e: E) => void) =>
  (e: E) => {
    e.stopPropagation();
    handler?.(e);
  };
