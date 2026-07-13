import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePluginParameters } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/hooks/usePluginParameters";
import { createDeferred, createResponse } from "./testHarness";

describe("usePluginParameters metadata state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("exposes loading, parameters and data through usePluginParameters", async () => {
    globalThis.fetch = vi.fn(async () =>
      createResponse({
        parameters: {
          stimulus: { type: "html_string", default: "" },
        },
        data: {
          response: { type: "string" },
        },
      }),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => usePluginParameters("plugin-test"));

    expect(result.current).toEqual({
      parameters: [],
      data: [],
      loading: true,
      error: null,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.parameters).toEqual([
      {
        key: "stimulus",
        label: "Stimulus",
        type: "html_string",
        default: "",
      },
    ]);
    expect(result.current.data).toEqual([
      { key: "response", label: "Response", type: "string" },
    ]);
    expect(result.current.error).toBeNull();
  });

  it("exposes loader errors through usePluginParameters", async () => {
    globalThis.fetch = vi.fn(async () =>
      createResponse({}, false),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => usePluginParameters("plugin-missing"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.parameters).toEqual([]);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe("Metadata not found");
  });

  it("ignores stale metadata responses after pluginName changes", async () => {
    const slowResponse = createDeferred<Response>();
    const fastResponse = createDeferred<Response>();
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes("plugin-slow")) return slowResponse.promise;
      return fastResponse.promise;
    }) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ pluginName }) => usePluginParameters(pluginName),
      { initialProps: { pluginName: "plugin-slow" } },
    );

    rerender({ pluginName: "plugin-fast" });

    await act(async () => {
      fastResponse.resolve(
        createResponse({
          parameters: {
            fast_param: { type: "string", default: "fast" },
          },
          data: {
            fast_data: { type: "number" },
          },
        }),
      );
      await fastResponse.promise;
    });

    await waitFor(() => {
      expect(result.current.parameters).toEqual([
        {
          key: "fast_param",
          label: "Fast Param",
          type: "string",
          default: "fast",
        },
      ]);
    });

    await act(async () => {
      slowResponse.resolve(
        createResponse({
          parameters: {
            slow_param: { type: "string", default: "slow" },
          },
          data: {
            slow_data: { type: "number" },
          },
        }),
      );
      await slowResponse.promise;
    });

    expect(result.current.parameters).toEqual([
      {
        key: "fast_param",
        label: "Fast Param",
        type: "string",
        default: "fast",
      },
    ]);
    expect(result.current.data).toEqual([
      { key: "fast_data", label: "Fast Data", type: "number" },
    ]);
  });

  it("ignores loader errors after the hook unmounts", async () => {
    const pendingResponse = createDeferred<Response>();
    globalThis.fetch = vi.fn(
      () => pendingResponse.promise,
    ) as unknown as typeof fetch;
    const { unmount } = renderHook(() =>
      usePluginParameters("plugin-unmounted"),
    );

    unmount();
    await act(async () => {
      pendingResponse.reject(new Error("late failure"));
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
