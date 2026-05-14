import { describe, it, expect } from "vitest";
import DevModeContext from "../../pages/ExperimentBuilder/contexts/DevModeContext";

describe("DevModeContext", () => {
  it("is defined as a context", () => {
    expect(DevModeContext).toBeDefined();
    expect(DevModeContext.Provider).toBeDefined();
    expect(DevModeContext.Consumer).toBeDefined();
  });

  it("has undefined as default value", () => {
    // DevModeContext is created with undefined default
    const defaults = (DevModeContext as any)._currentValue;
    expect(defaults).toBeUndefined();
  });
});
