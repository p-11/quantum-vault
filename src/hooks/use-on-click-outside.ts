import { useEffect, useRef, type RefObject } from 'react';

type UseOnClickOutsideInput<T extends HTMLElement> = {
  ref: RefObject<T | null>;
  onClickOutside: () => void;
};

export const useOnClickOutside = <T extends HTMLElement>({
  ref,
  onClickOutside
}: UseOnClickOutsideInput<T>): void => {
  const callbackRef = useRef(onClickOutside);
  callbackRef.current = onClickOutside;

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target;

      if (
        !ref.current ||
        !(target instanceof Node) ||
        ref.current.contains(target)
      ) {
        return;
      }

      callbackRef.current();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref]);
};
