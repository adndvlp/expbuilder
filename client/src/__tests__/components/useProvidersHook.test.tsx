import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FiServer } from "react-icons/fi";
import { useProviders } from "../../lib/useProviders";
import type { Provider } from "../../components/Chat/providers";

const catalogMocks = vi.hoisted(() => ({
  snapshot: [] as any[],
  listener: null as null | (() => void),
  loadProviders: vi.fn(),
  getProvidersSnapshot: vi.fn(() => catalogMocks.snapshot),
  subscribeProviders: vi.fn((cb: () => void) => {
    catalogMocks.listener = cb;
    return () => {
      catalogMocks.listener = null;
    };
  }),
}));

vi.mock("../../lib/providerCatalog", () => ({
  loadProviders: catalogMocks.loadProviders,
  getProvidersSnapshot: catalogMocks.getProvidersSnapshot,
  subscribeProviders: catalogMocks.subscribeProviders,
}));

function provider(id: string): Provider {
  return {
    id,
    name: id.toUpperCase(),
    Icon: FiServer,
    color: "#64748b",
    requiresKey: true,
    models: [],
  };
}

describe("useProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    catalogMocks.snapshot = [];
    catalogMocks.listener = null;
    catalogMocks.loadProviders.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses an existing catalog snapshot without triggering a load", () => {
    catalogMocks.snapshot = [provider("openai")];

    const { result } = renderHook(() => useProviders());

    expect(result.current.providers).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(catalogMocks.loadProviders).not.toHaveBeenCalled();
  });

  it("loads providers when the snapshot is empty and clears loading after completion", async () => {
    let resolveLoad!: (providers: Provider[]) => void;
    catalogMocks.loadProviders.mockReturnValue(
      new Promise<Provider[]>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const { result } = renderHook(() => useProviders());

    expect(result.current.providers).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(catalogMocks.loadProviders).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLoad([]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("reacts to provider catalog subscription updates", () => {
    const { result } = renderHook(() => useProviders());

    act(() => {
      catalogMocks.snapshot = [provider("anthropic"), provider("ollama")];
      catalogMocks.listener?.();
    });

    expect(result.current.providers.map((p) => p.id)).toEqual([
      "anthropic",
      "ollama",
    ]);
    expect(result.current.loading).toBe(false);
  });
});
