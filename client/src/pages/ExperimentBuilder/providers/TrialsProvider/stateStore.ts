import type { SetStateAction } from "react";

export type StateStore<T> = {
  get: () => T;
  resolve: (next: SetStateAction<T>) => T;
};

function isStateUpdater<T>(
  value: SetStateAction<T>,
): value is (previous: T) => T {
  return typeof value === "function";
}

export function createStateStore<T>(initialValue: T): StateStore<T> {
  let current = initialValue;

  return {
    get: () => current,
    resolve: (next) => {
      current = isStateUpdater(next) ? next(current) : next;
      return current;
    },
  };
}
