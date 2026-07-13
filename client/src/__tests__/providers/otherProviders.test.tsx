import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import PluginsProvider from "../../pages/ExperimentBuilder/providers/PluginsProvider";
import PluginsContext from "../../pages/ExperimentBuilder/contexts/PluginsContext";

function renderPluginsProvider() {
  let contextValue: any = null;
  const TestConsumer = () => {
    const ctx = React.useContext(PluginsContext);
    React.useEffect(() => {
      contextValue = ctx;
    }, [ctx]);
    return null;
  };

  const view = render(
    React.createElement(PluginsProvider, null,
      React.createElement(TestConsumer)
    )
  );

  return { ...view, getContext: () => contextValue };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("PluginsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plugins: [] }),
    } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with empty plugins", async () => {
    const { getContext } = renderPluginsProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(ctx).toBeDefined();
      expect(ctx.plugins).toEqual([]);
    });
  });

  it("provides plugin editor state", async () => {
    const { getContext } = renderPluginsProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(typeof ctx.isPluginEditor).toBe("boolean");
      expect(typeof ctx.setIsPluginEditor).toBe("function");
    });
  });

  it("provides saving state", async () => {
    const { getContext } = renderPluginsProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(typeof ctx.isSaving).toBe("boolean");
      expect(ctx.metadataError).toBe("");
    });
  });

  it("defaults a missing plugin list to empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    const { getContext } = renderPluginsProvider();

    await waitFor(() => {
      expect(getContext()?.plugins).toEqual([]);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("recovers from a plugin load failure while mounted", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("load failed"));
    const { getContext } = renderPluginsProvider();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(getContext()?.plugins).toEqual([]);
    });
  });

  it("ignores successful and failed plugin loads after unmount", async () => {
    const lateResponse = deferred<Response>();
    globalThis.fetch = vi.fn().mockReturnValue(lateResponse.promise);
    const successView = renderPluginsProvider();
    successView.unmount();

    await act(async () => {
      lateResponse.resolve({
        ok: true,
        json: () => Promise.resolve({ plugins: [{ index: 1 }] }),
      } as Response);
      await lateResponse.promise;
      await Promise.resolve();
    });

    const lateFailure = deferred<Response>();
    globalThis.fetch = vi.fn().mockReturnValue(lateFailure.promise);
    const failureView = renderPluginsProvider();
    failureView.unmount();

    await act(async () => {
      lateFailure.reject(new Error("late load failure"));
      await Promise.resolve();
    });
  });

  it("uses a fallback message for metadata extraction errors", async () => {
    let saveResult: Record<string, unknown> = { metadataStatus: "error" };
    let rejectSave = false;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/api/load-plugins")) {
        return {
          ok: true,
          json: async () => ({ plugins: [] }),
        } as Response;
      }
      if (rejectSave) throw new Error("save failed");
      return {
        ok: true,
        json: async () => saveResult,
      } as Response;
    }) as unknown as typeof fetch;
    const { getContext } = renderPluginsProvider();

    await waitFor(() => {
      expect(getContext()?.plugins).toEqual([]);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      getContext().setPlugins([{ index: 4, name: "Custom Plugin" }]);
    });

    await waitFor(() => {
      expect(getContext()?.metadataError).toBe("Error extracting metadata");
    }, { timeout: 5000 });

    saveResult = { metadataStatus: "ok" };
    act(() => {
      getContext().setPlugins([{ index: 4, name: "Updated Plugin" }]);
    });

    await waitFor(() => {
      expect(getContext()?.metadataError).toBe("");
    }, { timeout: 5000 });

    rejectSave = true;
    act(() => {
      getContext().setPlugins([{ index: 4, name: "Broken Save" }]);
    });
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error saving plugin config:",
        expect.any(Error),
      );
    }, { timeout: 5000 });
  });
});

describe("UrlProvider", () => {
  it("provides URL context values", async () => {
    // Dynamic import to avoid setup mocking interference
    const UrlProvider = (await import("../../pages/ExperimentBuilder/providers/UrlProvider")).default;
    const UrlContext = (await import("../../pages/ExperimentBuilder/contexts/UrlContext")).default;

    let contextValue: any = null;
    const TestConsumer = () => {
      const ctx = React.useContext(UrlContext);
      React.useEffect(() => {
        contextValue = ctx;
      }, [ctx]);
      return null;
    };

    render(
      React.createElement(UrlProvider, null,
        React.createElement(TestConsumer)
      )
    );

    await waitFor(() => {
      const ctx = contextValue;
      expect(ctx).toBeDefined();
      expect(ctx.experimentUrl).toContain("test-exp-123");
      expect(ctx.trialUrl).toContain("preview");
    });
  });
});

describe("CanvasStylesProvider", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, settings: {} }),
    } as Response);
  });

  it("initializes with default canvas styles", async () => {
    const CanvasStylesProvider = (await import("../../pages/ExperimentBuilder/providers/CanvasStylesProvider")).default;
    const CanvasStylesContext = (await import("../../pages/ExperimentBuilder/contexts/CanvasStylesContext")).default;

    let contextValue: any = null;
    const TestConsumer = () => {
      const ctx = React.useContext(CanvasStylesContext);
      React.useEffect(() => {
        contextValue = ctx;
      }, [ctx]);
      return null;
    };

    render(
      React.createElement(CanvasStylesProvider, { experimentID: "test-exp" },
        React.createElement(TestConsumer)
      )
    );

    await waitFor(() => {
      const ctx = contextValue;
      expect(ctx).toBeDefined();
      expect(ctx.canvasStyles).toBeDefined();
      expect(typeof ctx.setCanvasStyles).toBe("function");
    });
  });
});
