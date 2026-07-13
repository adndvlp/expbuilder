import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useCanvasStyles from "../../pages/ExperimentBuilder/hooks/useCanvasStyles";
import useDevMode from "../../pages/ExperimentBuilder/hooks/useDevMode";
import usePlugins from "../../pages/ExperimentBuilder/hooks/usePlugins";
import useUrl from "../../pages/ExperimentBuilder/hooks/useUrl";
import CanvasStylesProvider from "../../pages/ExperimentBuilder/providers/CanvasStylesProvider";
import DevModeProvider from "../../pages/ExperimentBuilder/providers/DevModeProvider";
import PluginsProvider from "../../pages/ExperimentBuilder/providers/PluginsProvider";
import UrlProvider from "../../pages/ExperimentBuilder/providers/UrlProvider";

const API_URL = "http://localhost:3000";

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ExperimentBuilder peripheral providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it("loads plugins and autosaves the first plugin added after an empty initial load", async () => {
    const plugin = {
      name: "plugin-custom",
      scripTag: "jsPsychCustom",
      pluginCode: "class CustomPlugin {}",
      index: 0,
    };

    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/load-plugins`) {
        return okJson({ plugins: [] });
      }
      if (url === `${API_URL}/api/save-plugin/0`) {
        return okJson({ metadataStatus: "ok" });
      }
      return okJson({});
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginsProvider>{children}</PluginsProvider>
    );
    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(`${API_URL}/api/load-plugins`);
    });
    await flushEffects();

    vi.useFakeTimers();

    act(() => {
      result.current.setPlugins([plugin]);
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/save-plugin/0`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plugin),
      },
    );
    expect(result.current.metadataError).toBe("");
  });

  it("surfaces plugin metadata errors returned by autosave", async () => {
    const initialPlugin = {
      name: "plugin-custom",
      scripTag: "jsPsychCustom",
      pluginCode: "class OldPlugin {}",
      index: 3,
    };
    const updatedPlugin = {
      ...initialPlugin,
      pluginCode: "class BrokenPlugin {}",
    };

    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/load-plugins`) {
        return okJson({ plugins: [initialPlugin] });
      }
      if (url === `${API_URL}/api/save-plugin/3`) {
        return okJson({
          metadataStatus: "error",
          metadataError: "Cannot extract parameters",
        });
      }
      return okJson({});
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginsProvider>{children}</PluginsProvider>
    );
    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.plugins).toEqual([initialPlugin]);
    });
    await flushEffects();
    vi.useFakeTimers();

    act(() => {
      result.current.setPlugins([updatedPlugin]);
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.metadataError).toBe("Cannot extract parameters");
  });

  it("falls back to an empty plugin list when loading plugins fails", async () => {
    fetchMock().mockRejectedValueOnce(new Error("load plugins failed"));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginsProvider>{children}</PluginsProvider>
    );
    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(`${API_URL}/api/load-plugins`);
    });
    await flushEffects();

    expect(result.current.plugins).toEqual([]);
  });

  it("logs plugin autosave failures", async () => {
    const error = new Error("save plugin failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const plugin = {
      name: "plugin-custom",
      scripTag: "jsPsychCustom",
      pluginCode: "class CustomPlugin {}",
      index: 0,
    };

    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/load-plugins`) {
        return okJson({ plugins: [] });
      }
      throw error;
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PluginsProvider>{children}</PluginsProvider>
    );
    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(`${API_URL}/api/load-plugins`);
    });
    await flushEffects();

    vi.useFakeTimers();

    act(() => {
      result.current.setPlugins([plugin]);
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Error saving plugin config:",
      error,
    );
  });

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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CanvasStylesProvider experimentID="exp-style">
        {children}
      </CanvasStylesProvider>
    );
    const { result } = renderHook(() => useCanvasStyles(), { wrapper });

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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CanvasStylesProvider experimentID="exp-style">
        {children}
      </CanvasStylesProvider>
    );
    const { result } = renderHook(() => useCanvasStyles(), { wrapper });

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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CanvasStylesProvider experimentID="exp-style">
        {children}
      </CanvasStylesProvider>
    );
    const { result } = renderHook(() => useCanvasStyles(), { wrapper });

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
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CanvasStylesProvider>{children}</CanvasStylesProvider>
    );
    const { result } = renderHook(() => useCanvasStyles(), { wrapper });

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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CanvasStylesProvider experimentID="exp-style">
        {children}
      </CanvasStylesProvider>
    );
    renderHook(() => useCanvasStyles(), { wrapper });

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "Could not load appearance settings:",
        error,
      );
    });
  });

  it("derives experiment and preview URLs from the active experiment id", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UrlProvider>{children}</UrlProvider>
    );
    const { result } = renderHook(() => useUrl(), { wrapper });

    await waitFor(() => {
      expect(result.current.experimentUrl).toBe(
        `${API_URL}/test-exp-123`,
      );
      expect(result.current.trialUrl).toBe(
        `${API_URL}/test-exp-123/preview`,
      );
    });

    act(() => {
      result.current.setExperimentUrl("https://custom.test/experiment");
      result.current.setTrialUrl("https://custom.test/preview");
    });

    expect(result.current.experimentUrl).toBe("https://custom.test/experiment");
    expect(result.current.trialUrl).toBe("https://custom.test/preview");
  });

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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DevModeProvider>{children}</DevModeProvider>
    );
    const { result } = renderHook(() => useDevMode(), { wrapper });

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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DevModeProvider>{children}</DevModeProvider>
    );
    const { result } = renderHook(() => useDevMode(), { wrapper });

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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockRejectedValueOnce(error);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DevModeProvider>{children}</DevModeProvider>
    );
    renderHook(() => useDevMode(), { wrapper });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Error loading config:", error);
    });
  });

  it("logs DevModeProvider save failures after the debounce", async () => {
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DevModeProvider>{children}</DevModeProvider>
    );
    const { result } = renderHook(() => useDevMode(), { wrapper });

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
