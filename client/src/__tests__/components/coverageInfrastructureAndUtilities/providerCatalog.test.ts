import { describe, expect, it, vi } from "vitest";
import "./testHarness";

describe("coverage utilities: provider catalog", () => {
  it("loads provider catalog metadata, caches snapshots and notifies subscribers", async () => {
    vi.resetModules();
    globalThis.fetch = vi.fn(async () => ({
      json: async () => [
        {
          id: "custom-provider",
          name: "Custom Provider",
          source: "test",
          env: ["CUSTOM_KEY"],
          npm: null,
          api: null,
          models: [
            {
              id: "custom-mini",
              name: "Custom Mini",
              contextK: null,
              outputK: null,
              tool_call: true,
              reasoning: true,
              cost: { input: 0.1, output: 0.2 },
            },
          ],
        },
        {
          id: "openai",
          name: "OpenAI",
          source: "test",
          env: ["OPENAI_API_KEY"],
          npm: null,
          api: null,
          models: [
            {
              id: "gpt-5-pro",
              name: "GPT 5 Pro",
              contextK: 256,
              outputK: null,
              tool_call: false,
              reasoning: false,
              cost: null,
            },
          ],
        },
        {
          id: "another-provider",
          name: "Another Provider",
          source: "test",
          env: [],
          npm: null,
          api: null,
          models: [
            {
              id: "plain-model",
              name: "Extraordinary Model Name",
              contextK: null,
              outputK: null,
              tool_call: false,
              reasoning: false,
              cost: null,
            },
          ],
        },
      ],
    })) as unknown as typeof fetch;

    const catalog = await import("../../../lib/providerCatalog");
    const listener = vi.fn();
    const unsubscribe = catalog.subscribeProviders(listener);

    expect(catalog.getProvidersSnapshot()).toEqual([]);
    const providers = await catalog.loadProviders();

    expect(providers.map((provider) => provider.id)).toEqual([
      "openai",
      "another-provider",
      "custom-provider",
    ]);
    expect(providers[0].requiresKey).toBe(true);
    expect(providers[0].models[0]).toEqual(
      expect.objectContaining({
        shortName: "GPT 5",
        contextK: 256,
        tier: "powerful",
        description: "256K context",
      }),
    );
    expect(providers[1].models[0]).toEqual(
      expect.objectContaining({
        shortName: "Extraordinary…",
        contextK: 0,
        tier: "balanced",
        description: "Extraordinary Model Name",
      }),
    );
    expect(providers[2].models[0]).toEqual(
      expect.objectContaining({
        contextK: 0,
        tier: "fast",
        description: "Chain-of-thought reasoning · Tool use · $0.1/M in",
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(catalog.getProvidersSnapshot()).toBe(providers);
    expect(catalog.findCatalogProvider("openai")?.name).toBe("OpenAI");
    await expect(catalog.loadProviders()).resolves.toBe(providers);
    catalog.prefetchProviders();

    unsubscribe();
    catalog.subscribeProviders(vi.fn())();
  });

  it("reuses the in-flight provider catalog request", async () => {
    vi.resetModules();
    let resolveFetch!: (response: { json: () => Promise<unknown[]> }) => void;
    globalThis.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    const catalog = await import("../../../lib/providerCatalog");
    const firstLoad = catalog.loadProviders();
    const secondLoad = catalog.loadProviders();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    resolveFetch({
      json: async () => [],
    });
    await expect(firstLoad).resolves.toEqual([]);
    await expect(secondLoad).resolves.toEqual([]);
  });

  it("falls back to the current provider snapshot when catalog loading fails", async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => {
      throw new Error("catalog down");
    }) as unknown as typeof fetch;

    const catalog = await import("../../../lib/providerCatalog");

    await expect(catalog.loadProviders()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "[providerCatalog] fetch failed:",
      "catalog down",
    );
    catalog.prefetchProviders();
  });
});
