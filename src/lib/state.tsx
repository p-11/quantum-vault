import {
  createContext,
  useContext,
  useState,
  type Context,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import type { Stateful } from './types';

export class NoContextError extends Error {
  contextId: string;

  constructor(contextId: string) {
    super(`No context provided for ${contextId}`);
    this.contextId = contextId;
  }
}

export function createContextHook<T>(
  ctx: Context<T | undefined>,
  contextId: string
): () => T;
export function createContextHook<T, R>(
  ctx: Context<T | undefined>,
  contextId: string,
  transform: (context: T) => R
): () => R;
export function createContextHook<T, R = T>(
  ctx: Context<T | undefined>,
  contextId: string,
  transform?: (context: T) => R
): () => T | R {
  return () => {
    const context = useContext(ctx);
    if (context === undefined) {
      throw new NoContextError(contextId);
    }
    return transform ? transform(context) : context;
  };
}

export const setupValueProvider = <T,>(contextId: string) => {
  const Context = createContext<T | undefined>(undefined);

  const Provider = ({ children, value }: { children: ReactNode; value: T }) => (
    <Context.Provider value={value}>{children}</Context.Provider>
  );

  const useValue = (): T => {
    const context = useContext(Context);
    if (context === undefined) {
      throw new NoContextError(contextId);
    }
    return context;
  };

  return [Provider, useValue] as const;
};

export const setupStateProvider = <T,>(contextId: string, initialValue?: T) => {
  const Context = createContext<Stateful<T> | undefined>(undefined);

  const Provider = ({
    children,
    initialValue: propInitialValue
  }: {
    children: ReactNode;
    initialValue?: T;
  }) => {
    const resolved = propInitialValue ?? initialValue;
    if (resolved === undefined) {
      throw new Error(
        `${contextId} provider requires an initialValue via the factory or the Provider prop`
      );
    }

    const [value, setValue] = useState<T>(() => resolved);

    return (
      <Context.Provider value={{ value, setValue }}>
        {children}
      </Context.Provider>
    );
  };

  const useStateTuple = (): [T, Dispatch<SetStateAction<T>>] => {
    const context = useContext(Context);
    if (context === undefined) {
      throw new NoContextError(contextId);
    }
    return [context.value, context.setValue];
  };

  return [Provider, useStateTuple] as const;
};
