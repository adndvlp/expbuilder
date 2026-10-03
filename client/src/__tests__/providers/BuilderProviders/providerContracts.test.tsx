import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useExperimentAppearance from "../../../pages/ExperimentBuilder/hooks/useExperimentAppearance";
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

    const { result } = renderHook(() => useExperimentAppearance());
    act(() => {
      result.current.setAppearance((prev) => prev);
    });
    expect(result.current.appearance).toEqual({
      backgroundColor: "#ffffff",
      fullScreen: true,
      progressBar: false,
    });
  });
});
