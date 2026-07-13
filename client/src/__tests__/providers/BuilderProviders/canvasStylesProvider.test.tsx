import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useCanvasStyles from "../../../pages/ExperimentBuilder/hooks/useCanvasStyles";
import CanvasStylesProvider from "../../../pages/ExperimentBuilder/providers/CanvasStylesProvider";
import {
  API_URL,
  cleanupProviderTest,
  fetchMock,
  okJson,
  prepareProviderTest,
} from "./testHarness";

function ExperimentCanvasStylesWrapper({ children }: { children: ReactNode }) {
  return (
    <CanvasStylesProvider experimentID="exp-style">
      {children}
    </CanvasStylesProvider>
  );
}

function DefaultCanvasStylesWrapper({ children }: { children: ReactNode }) {
  return <CanvasStylesProvider>{children}</CanvasStylesProvider>;
}

describe("CanvasStylesProvider", () => {
  beforeEach(prepareProviderTest);
  afterEach(cleanupProviderTest);

  it("loads appearance settings into CanvasStylesProvider and keeps defaults for omitted fields", async () => {
    fetchMock().mockResolvedValue(
      okJson({
        success: true,
        settings: {
          backgroundColor: "#101820",
          fullScreen: false,
        },
      }),
    );

    const { result } = renderHook(() => useCanvasStyles(), {
      wrapper: ExperimentCanvasStylesWrapper,
    });

    await waitFor(() => {
      expect(result.current.canvasStyles).toEqual({
        backgroundColor: "#101820",
        width: 1024,
        height: 768,
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

    const { result } = renderHook(() => useCanvasStyles(), {
      wrapper: ExperimentCanvasStylesWrapper,
    });

    await waitFor(() => {
      expect(result.current.canvasStyles).toEqual({
        backgroundColor: "#ffffff",
        width: 1024,
        height: 768,
        fullScreen: true,
        progressBar: true,
      });
    });
  });

  it("ignores unsuccessful appearance settings responses", async () => {
    fetchMock().mockResolvedValue(okJson({ success: false }));

    const { result } = renderHook(() => useCanvasStyles(), {
      wrapper: ExperimentCanvasStylesWrapper,
    });

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/appearance-settings/exp-style`,
      );
    });
    expect(result.current.canvasStyles).toEqual({
      backgroundColor: "#ffffff",
      width: 1024,
      height: 768,
      fullScreen: true,
      progressBar: false,
    });
  });

  it("does not request appearance settings without an experiment id", () => {
    const { result } = renderHook(() => useCanvasStyles(), {
      wrapper: DefaultCanvasStylesWrapper,
    });

    expect(fetchMock()).not.toHaveBeenCalled();
    expect(result.current.canvasStyles).toEqual({
      backgroundColor: "#ffffff",
      width: 1024,
      height: 768,
      fullScreen: true,
      progressBar: false,
    });
  });

  it("warns when appearance settings fail to load", async () => {
    const error = new Error("appearance down");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock().mockRejectedValue(error);

    renderHook(() => useCanvasStyles(), {
      wrapper: ExperimentCanvasStylesWrapper,
    });

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "Could not load appearance settings:",
        error,
      );
    });
  });
});
