import { useEffect, useRef } from 'react';

type UseIntervalInput = {
  callback: () => void;
  delay: number | null;
};

export const useInterval = ({ callback, delay }: UseIntervalInput): void => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (delay === null) {
      return;
    }

    const id = setInterval(() => callbackRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
};
