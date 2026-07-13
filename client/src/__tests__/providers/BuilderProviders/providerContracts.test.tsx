import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useCanvasStyles from "../../../pages/ExperimentBuilder/hooks/useCanvasStyles";
import usePlugins from "../../../pages/ExperimentBuilder/hooks/usePlugins";
import useUrl from "../../../pages/ExperimentBuilder/hooks/useUrl";
import { cleanupProviderTest, prepareProviderTest } from "./testHarness";

describe("ExperimentBuilder peripheral provider contracts", () => {
  beforeEach(prepareProviderTest);
  afterEach(cleanupProviderTest);

  it("throws provider hook errors outside their required providers", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => usePlugins())).toThrow(
      "usePlugins must be used within a PluginsProvider",
    );
    expect(() => renderHook(() => useUrl())).toThrow(
      "useUrl must be used within a UrlProvider",
    );

    const { result } = renderHook(() => useCanvasStyles());
    act(() => {
      result.current.setCanvasStyles((prev) => prev);
    });
    expect(result.current.canvasStyles).toEqual({
      backgroundColor: "#ffffff",
      width: 1024,
      height: 768,
      fullScreen: true,
      progressBar: false,
    });
  });
});
