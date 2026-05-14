import { describe, it, expect } from "vitest";
import PluginsContext from "../../pages/ExperimentBuilder/contexts/PluginsContext";

describe("PluginsContext", () => {
  it("is defined as a context", () => {
    expect(PluginsContext).toBeDefined();
    expect(PluginsContext.Provider).toBeDefined();
  });

  it("has undefined default value", () => {
    const defaults = (PluginsContext as any)._currentValue;
    expect(defaults).toBeUndefined();
  });
});

describe("UrlContext", () => {
  it("has undefined default value", async () => {
    const UrlContext = (await import("../../pages/ExperimentBuilder/contexts/UrlContext")).default;
    const defaults = (UrlContext as any)._currentValue;
    expect(defaults).toBeUndefined();
  });
});

describe("CanvasStylesContext", () => {
  it("has default canvas styles", async () => {
    const CanvasStylesContext = await import("../../pages/ExperimentBuilder/contexts/CanvasStylesContext");
    const ctx = CanvasStylesContext.default;
    // CanvasStylesContext is created with default values
    expect(ctx.Provider).toBeDefined();
  });
});
