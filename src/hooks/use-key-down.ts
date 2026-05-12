import { useEffect, useRef } from 'react';

type UseKeyDownOptions = {
  stopPropagation?: boolean;
  preventDefault?: boolean;
};

type UseKeyDownInput = {
  keys: string[];
  handler?: (event: KeyboardEvent) => void;
  options?: UseKeyDownOptions;
};

export const useKeyDown = ({
  keys,
  handler,
  options
}: UseKeyDownInput): void => {
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!keysRef.current.includes(event.key)) {
        return;
      }

      if (options?.stopPropagation) {
        event.stopPropagation();
      }

      if (options?.preventDefault) {
        event.preventDefault();
      }

      handlerRef.current?.(event);
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [options?.stopPropagation, options?.preventDefault]);
};
