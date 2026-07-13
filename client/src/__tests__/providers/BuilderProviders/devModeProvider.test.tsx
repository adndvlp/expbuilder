import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useDevMode from "../../../pages/ExperimentBuilder/hooks/useDevMode";
import DevModeProvider from "../../../pages/ExperimentBuilder/providers/DevModeProvider";
import {
  API_URL,
  cleanupProviderTest,
  fetchMock,
  okJson,
  prepareProviderTest,
} from "./testHarness";

function DevModeWrapper({ children }: { children: ReactNode }) {
  return <DevModeProvider>{children}</DevModeProvider>;
}

describe("DevModeProvider", () => {
  beforeEach(prepareProviderTest);
  afterEach(cleanupProviderTest);

  it("loads dev mode config, custom init params and custom pre-init code", async () => {
    fetchMock().mockResolvedValue(
      okJson({
        config: {
          generatedCode: "const generated = true;",
          customCode: "console.log('custom');",
          customInitJsPsychParams: {
            local: { show_progress_bar: "true" },
            public: { on_finish: "() => saveData()" },
          },
          customPreInitCode: {
            local: "const localSetup = true;",
            public: "const publicSetup = true;",
          },
        },
        isDevMode: true,
        isSaveMode: true,
      }),
    );

    const { result } = renderHook(() => useDevMode(), {
      wrapper: DevModeWrapper,
    });

    await waitFor(() => {
      expect(result.current.code).toBe("const generated = true;");
    });

    expect(result.current.isDevMode).toBe(true);
    expect(result.current.isSaveMode).toBe(true);
    expect(result.current.customCode).toBe("console.log('custom');");
    expect(result.current.customInitJsPsychParams).toEqual({
      local: { show_progress_bar: "true" },
      public: { on_finish: "() => saveData()" },
    });
    expect(result.current.customPreInitCode).toEqual({
      local: "const localSetup = true;",
      public: "const publicSetup = true;",
    });
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/load-config/test-exp-123`,
    );
  });

  it("debounces DevModeProvider saves with generated and custom code state", async () => {
    vi.useFakeTimers();
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/load-config/test-exp-123`) {
        return okJson({
          config: {
            generatedCode: "",
            customCode: "",
          },
          isDevMode: false,
          isSaveMode: false,
        });
      }
      return okJson({ success: true });
    });

    const { result } = renderHook(() => useDevMode(), {
      wrapper: DevModeWrapper,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      result.current.setDevMode(true);
      result.current.setSaveMode(true);
      result.current.setCode("const nextCode = true;");
      result.current.setCustomCode("console.log('next');");
      result.current.setCustomInitJsPsychParam(
        "local",
        "show_progress_bar",
        "true",
      );
      result.current.setCustomPreInitCode("public", "const pre = true;");
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock()).toHaveBeenLastCalledWith(
      `${API_URL}/api/save-config/test-exp-123`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            generatedCode: "const nextCode = true;",
            customCode: "console.log('next');",
            customInitJsPsychParams: {
              local: { show_progress_bar: "true" },
              public: {},
            },
            customPreInitCode: {
              local: "",
              public: "const pre = true;",
            },
          },
          isDevMode: true,
          isSaveMode: true,
        }),
      },
    );
  });

  it("logs DevModeProvider load failures", async () => {
    const error = new Error("load failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock().mockRejectedValueOnce(error);

    renderHook(() => useDevMode(), { wrapper: DevModeWrapper });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Error loading config:", error);
    });
  });

  it("logs DevModeProvider save failures after the debounce", async () => {
    vi.useFakeTimers();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/load-config/test-exp-123`) {
        return okJson({
          config: {
            generatedCode: "",
            customCode: "",
          },
          isDevMode: false,
          isSaveMode: false,
        });
      }
      return okJson({ success: false }, false);
    });

    const { result } = renderHook(() => useDevMode(), {
      wrapper: DevModeWrapper,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      result.current.setCode("const willFail = true;");
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Error saving dev mode:",
      expect.any(Error),
    );
  });
});
