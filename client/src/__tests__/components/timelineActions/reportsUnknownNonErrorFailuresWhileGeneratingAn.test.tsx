import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DevModeContext from "../../../pages/ExperimentBuilder/contexts/DevModeContext";
import Actions from "../../../pages/ExperimentBuilder/components/Timeline/Actions";

const API_URL = "http://localhost:3000";

function okJson(
  payload: unknown,
  ok = true,
  status = ok ? 200 : 500,
): Response {
  return {
    ok,
    status,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

function installClipboard(writeText = vi.fn(async () => undefined)) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

function installLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };

  vi.stubGlobal("localStorage", storage);
  return storage;
}

describe("Timeline Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === `${API_URL}/api/experiment/exp-123`) {
        return okJson({ experiment: {} });
      }
      return okJson({ success: true });
    }) as unknown as typeof fetch;
    installClipboard();
    installLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  function renderActions(
    overrides: Partial<Parameters<typeof Actions>[0]> = {},
    isDevMode = false,
  ) {
    const setCode = vi.fn();
    const props = {
      experimentID: "exp-123",
      lastPagesUrl: "",
      isTunnelActive: false,
      setIsSubmitting: vi.fn(),
      generateLocalExperiment: vi.fn(async () => "local-code"),
      generatedBaseCode: vi.fn(async () => "base-code"),
      setSubmitStatus: vi.fn(),
      setExperimentUrl: vi.fn(),
      setTunnelCopyStatus: vi.fn(),
      setPagesCopyStatus: vi.fn(),
      setTunnelStatus: vi.fn(),
      setTunnelActive: vi.fn(),
      setIsTunnelCreating: vi.fn(),
      setActiveTunnelUrl: vi.fn(),
      setLastPagesUrl: vi.fn(),
      ...overrides,
    };
    const contextValue = {
      isDevMode,
      setDevMode: vi.fn(),
      isSaveMode: false,
      setSaveMode: vi.fn(),
      code: "",
      setCode,
      customCode: "",
      setCustomCode: vi.fn(),
      customInitJsPsychParams: { local: {}, public: {} },
      setCustomInitJsPsychParam: vi.fn(),
      customPreInitCode: { local: "", public: "" },
      setCustomPreInitCode: vi.fn(),
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DevModeContext.Provider value={contextValue}>
        {children}
      </DevModeContext.Provider>
    );

    return {
      props,
      setCode,
      ...renderHook(() => Actions(props), { wrapper }),
    };
  }

  it("reports unknown non-Error failures while generating an experiment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, props } = renderActions({
      generateLocalExperiment: vi.fn(async () => {
        throw "generation failed";
      }),
    });

    await act(async () => {
      await result.current.handleRunExperiment();
    });

    expect(props.setSubmitStatus).toHaveBeenCalledWith(
      "An error occurred: Unknown error",
    );
  });

  it("does not create a local sharing tunnel when the warning is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleShareLocalExperiment();
    });

    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/create-tunnel`,
      expect.anything(),
    );
    expect(props.setIsTunnelCreating).not.toHaveBeenCalledWith(true);
  });

  it("creates a local sharing tunnel and persists the tunnel URL", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/create-tunnel`) {
        return okJson({ success: true, url: "https://tunnel.test" });
      }
      return okJson({ experiment: {} });
    });
    const { result, props } = renderActions();

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/experiment/exp-123`,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    let sharedUrl: string | undefined;
    await act(async () => {
      sharedUrl = await result.current.handleShareLocalExperiment();
    });

    expect(sharedUrl).toBe("https://tunnel.test/exp-123");
    expect(props.setExperimentUrl).toHaveBeenCalledWith(
      "https://tunnel.test/exp-123",
    );
    expect(props.setActiveTunnelUrl).toHaveBeenCalledWith(
      "https://tunnel.test",
    );
    expect(localStorage.getItem("tunnelActive")).toBe("true");
    expect(localStorage.getItem("tunnelUrl")).toBe("https://tunnel.test");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://tunnel.test/exp-123",
    );
    expect(props.setTunnelActive).toHaveBeenCalledWith(true);
    expect(props.setIsTunnelCreating).toHaveBeenLastCalledWith(false);
  });

  it("keeps a successful tunnel active when clipboard copy fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    installClipboard(
      vi.fn(async () => {
        throw new Error("clipboard denied");
      }),
    );
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/create-tunnel`) {
        return okJson({ success: true, url: "https://tunnel.test" });
      }
      return okJson({ experiment: {} });
    });
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleShareLocalExperiment();
    });

    expect(props.setTunnelActive).toHaveBeenCalledWith(true);
    expect(props.setTunnelStatus).toHaveBeenCalledWith("Tunnel active");
    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy public link: ",
      expect.any(Error),
    );
  });

  it("reports tunnel API failures without marking the tunnel active", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/create-tunnel`) {
        return okJson({ success: false, error: "Port unavailable" });
      }
      return okJson({ experiment: {} });
    });
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleShareLocalExperiment();
    });

    expect(props.setTunnelStatus).toHaveBeenCalledWith(
      "Failed: Port unavailable",
    );
    expect(props.setTunnelActive).not.toHaveBeenCalledWith(true);
    expect(props.setIsTunnelCreating).toHaveBeenLastCalledWith(false);
  });

  it("clears tunnel failure statuses after API and connection errors", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/create-tunnel`) {
        return okJson({ success: false });
      }
      return okJson({ experiment: {} });
    });
    const apiFailure = renderActions();

    await act(async () => {
      await apiFailure.result.current.handleShareLocalExperiment();
    });
    expect(apiFailure.props.setTunnelStatus).toHaveBeenCalledWith(
      "Failed: Unknown error",
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(apiFailure.props.setTunnelStatus).toHaveBeenCalledWith("");

    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/create-tunnel`) {
        throw new Error("offline");
      }
      return okJson({ experiment: {} });
    });
    const connectionFailure = renderActions();

    await act(async () => {
      await connectionFailure.result.current.handleShareLocalExperiment();
    });
    expect(connectionFailure.props.setTunnelStatus).toHaveBeenCalledWith(
      "Connection error: offline",
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(connectionFailure.props.setTunnelStatus).toHaveBeenCalledWith("");
  });
});
