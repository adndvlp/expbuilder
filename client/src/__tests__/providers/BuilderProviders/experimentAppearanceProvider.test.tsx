import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useExperimentAppearance from "../../../pages/ExperimentBuilder/hooks/useExperimentAppearance";
import ExperimentAppearanceProvider from "../../../pages/ExperimentBuilder/providers/ExperimentAppearanceProvider";
import {
  API_URL,
  cleanupProviderTest,
  fetchMock,
  okJson,
  prepareProviderTest,
} from "./testHarness";

function ExperimentAppearanceWrapper({ children }: { children: ReactNode }) {
  return (
    <ExperimentAppearanceProvider experimentID="exp-style">
      {children}
    </ExperimentAppearanceProvider>
  );
}

function DefaultAppearanceWrapper({ children }: { children: ReactNode }) {
  return <ExperimentAppearanceProvider>{children}</ExperimentAppearanceProvider>;
}

describe("ExperimentAppearanceProvider", () => {
  beforeEach(prepareProviderTest);
  afterEach(cleanupProviderTest);

  it("loads appearance settings into ExperimentAppearanceProvider and keeps defaults for omitted fields", async () => {
    fetchMock().mockResolvedValue(
      okJson({
        success: true,
        settings: {
          backgroundColor: "#101820",
          fullScreen: false,
        },
      }),
    );

    const { result } = renderHook(() => useExperimentAppearance(), {
      wrapper: ExperimentAppearanceWrapper,
    });

    await waitFor(() => {
      expect(result.current.appearance).toEqual({
        backgroundColor: "#101820",
        fullScreen: false,
        progressBar: false,
      });
    });
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/appearance-settings/exp-style`,
    );
  });

  it("keeps canvas style defaults when appearance fields are omitted", async () => {
    fetchMock().mockResolvedValue(
      okJson({
        success: true,
        settings: {
          progressBar: true,
        },
      }),
    );

    const { result } = renderHook(() => useExperimentAppearance(), {
      wrapper: ExperimentAppearanceWrapper,
    });

    await waitFor(() => {
      expect(result.current.appearance).toEqual({
        backgroundColor: "#ffffff",
        fullScreen: true,
        progressBar: true,
      });
    });
  });

  it("ignores unsuccessful appearance settings responses", async () => {
    fetchMock().mockResolvedValue(okJson({ success: false }));

    const { result } = renderHook(() => useExperimentAppearance(), {
      wrapper: ExperimentAppearanceWrapper,
    });

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/appearance-settings/exp-style`,
      );
    });
    expect(result.current.appearance).toEqual({
      backgroundColor: "#ffffff",
      fullScreen: true,
      progressBar: false,
    });
  });

  it("does not request appearance settings without an experiment id", () => {
    const { result } = renderHook(() => useExperimentAppearance(), {
      wrapper: DefaultAppearanceWrapper,
    });

    expect(fetchMock()).not.toHaveBeenCalled();
    expect(result.current.appearance).toEqual({
      backgroundColor: "#ffffff",
      fullScreen: true,
      progressBar: false,
    });
  });

  it("warns when appearance settings fail to load", async () => {
    const error = new Error("appearance down");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock().mockRejectedValue(error);

    renderHook(() => useExperimentAppearance(), {
      wrapper: ExperimentAppearanceWrapper,
    });

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "Could not load appearance settings:",
        error,
      );
    });
  });
});
