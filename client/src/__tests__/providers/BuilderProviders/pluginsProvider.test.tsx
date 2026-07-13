import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import usePlugins from "../../../pages/ExperimentBuilder/hooks/usePlugins";
import PluginsProvider from "../../../pages/ExperimentBuilder/providers/PluginsProvider";
import {
  API_URL,
  cleanupProviderTest,
  fetchMock,
  flushEffects,
  okJson,
  prepareProviderTest,
} from "./testHarness";

function PluginsWrapper({ children }: { children: ReactNode }) {
  return <PluginsProvider>{children}</PluginsProvider>;
}

describe("PluginsProvider", () => {
  beforeEach(prepareProviderTest);
  afterEach(cleanupProviderTest);

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

    const { result } = renderHook(() => usePlugins(), {
      wrapper: PluginsWrapper,
    });

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

    expect(fetchMock()).toHaveBeenCalledWith(`${API_URL}/api/save-plugin/0`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plugin),
    });
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

    const { result } = renderHook(() => usePlugins(), {
      wrapper: PluginsWrapper,
    });

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

    const { result } = renderHook(() => usePlugins(), {
      wrapper: PluginsWrapper,
    });

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(`${API_URL}/api/load-plugins`);
    });
    await flushEffects();

    expect(result.current.plugins).toEqual([]);
  });

  it("logs plugin autosave failures", async () => {
    const error = new Error("save plugin failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
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

    const { result } = renderHook(() => usePlugins(), {
      wrapper: PluginsWrapper,
    });

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
});
