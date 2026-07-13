import { vi } from "vitest";

export function createResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
