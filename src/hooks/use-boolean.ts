import { useRef, useState } from 'react';

type BooleanActions = {
  set: () => void;
  unset: () => void;
  toggle: () => void;
  update: (value: boolean) => void;
};

export const useBoolean = (initial = false): [boolean, BooleanActions] => {
  const [value, setValue] = useState(initial);

  const actionsRef = useRef<BooleanActions>({
    set: () => setValue(true),
    unset: () => setValue(false),
    toggle: () => setValue(previous => !previous),
    update: setValue
  });

  return [value, actionsRef.current];
};
