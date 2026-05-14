import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
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

  render(
    React.createElement(PluginsProvider, null,
      React.createElement(TestConsumer)
    )
  );

  return { getContext: () => contextValue };
}

describe("PluginsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plugins: [] }),
    } as Response);
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
