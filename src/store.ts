export type Listener<T> = (state: T) => void;

export interface Store<T> {
  get(): T;
  set(updater: T | ((prev: T) => T)): void;
  subscribe(fn: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => state,
    set: (updater) => {
      const next =
        typeof updater === "function"
          ? (updater as (p: T) => T)(state)
          : updater;
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((l) => l(state));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
