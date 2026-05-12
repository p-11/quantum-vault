import { useRef } from 'react';
import { attempt } from '@/lib/attempt';

type UseClickGateInput = {
  handler: () => void | Promise<void>;
  gateTimeMs?: number;
};

const defaultGateTimeMs = 500;

export const useClickGate = ({
  handler,
  gateTimeMs = defaultGateTimeMs
}: UseClickGateInput) => {
  const lastClickRef = useRef(0);

  return () => {
    const now = Date.now();
    if (now - lastClickRef.current < gateTimeMs) {
      return;
    }

    lastClickRef.current = now;
    void attempt(handler);
  };
};
