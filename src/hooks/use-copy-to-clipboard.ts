import { useEffect, useRef, useState } from 'react';
import { attempt } from '@/lib/attempt';

type CopyStatus = 'idle' | 'copied' | 'failed';

const resetDelayMs = 2000;

export const useCopyToClipboard = (): {
  status: CopyStatus;
  copy: (text: string) => Promise<void>;
} => {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  const copy = async (text: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const result = await attempt(() => navigator.clipboard.writeText(text));
    setStatus('error' in result ? 'failed' : 'copied');

    timerRef.current = setTimeout(() => {
      setStatus('idle');
      timerRef.current = null;
    }, resetDelayMs);
  };

  return { status, copy };
};
