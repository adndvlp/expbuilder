import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("coverage smoke: provider catalog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("loads, sorts, subscribes and looks up catalog providers", async () => {
    globalThis.fetch = vi.fn(async () => ({
      json: async () => [
        {
          id: "custom-provider",
          name: "Custom Provider",
          source: "remote",
          env: ["CUSTOM_KEY"],
          npm: null,
          api: null,
          models: [
            {
              id: "custom-large",
              name: "Custom Large Model",
              contextK: 128,
              outputK: 8,
              tool_call: true,
              reasoning: true,
              cost: { input: 1, output: 2 },
            },
          ],
        },
        {
          id: "openai",
          name: "OpenAI",
          source: "remote",
          env: ["OPENAI_API_KEY"],
          npm: null,
          api: null,
          models: [
            {
              id: "gpt-mini",
              name: "GPT Mini",
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
    const providers = await catalog.loadProviders();

    expect(listener).toHaveBeenCalled();
    expect(providers.map((provider) => provider.id)).toEqual([
      "openai",
      "custom-provider",
    ]);
    expect(providers[0].models[0]).toEqual(
      expect.objectContaining({
        id: "gpt-mini",
        shortName: "GPT Mini",
        tier: "fast",
        contextK: 0,
      }),
    );
    expect(providers[1].models[0].description).toContain("Tool use");
    expect(catalog.getProvidersSnapshot()).toBe(providers);
    expect(catalog.findCatalogProvider("openai")?.name).toBe("OpenAI");

    unsubscribe();
    await catalog.loadProviders();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to an empty provider list after fetch errors", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const catalog = await import("../../../lib/providerCatalog");

    await expect(catalog.loadProviders()).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(
      "[providerCatalog] fetch failed:",
      "offline",
    );

    catalog.prefetchProviders();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});
