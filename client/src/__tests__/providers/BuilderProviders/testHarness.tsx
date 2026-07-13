import { act } from "@testing-library/react";
import { vi } from "vitest";

export const API_URL = "http://localhost:3000";

export function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

export function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

export async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function prepareProviderTest() {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
}

export function cleanupProviderTest() {
  vi.useRealTimers();
  vi.restoreAllMocks();
}
