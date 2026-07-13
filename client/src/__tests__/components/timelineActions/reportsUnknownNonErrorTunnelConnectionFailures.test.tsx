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

  it("reports unknown non-Error tunnel connection failures", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/create-tunnel`) throw "offline";
      return okJson({ experiment: {} });
    });
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleShareLocalExperiment();
    });

    expect(props.setTunnelStatus).toHaveBeenCalledWith(
      "Connection error: Unknown error",
    );
  });

  it("closes a local tunnel and clears persisted tunnel state", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.setItem("tunnelActive", "true");
    localStorage.setItem("tunnelUrl", "https://tunnel.test");
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/close-tunnel`) {
        return okJson({ success: true, message: "Tunnel closed" });
      }
      return okJson({ experiment: {} });
    });
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleCloseTunnel();
    });

    expect(fetchMock()).toHaveBeenCalledWith(`${API_URL}/api/close-tunnel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentID: "exp-123" }),
    });
    expect(props.setExperimentUrl).toHaveBeenCalledWith(`${API_URL}/exp-123`);
    expect(props.setActiveTunnelUrl).toHaveBeenCalledWith("");
    expect(props.setTunnelActive).toHaveBeenCalledWith(false);
    expect(localStorage.getItem("tunnelActive")).toBeNull();
    expect(localStorage.getItem("tunnelUrl")).toBeNull();
    expect(props.setTunnelStatus).toHaveBeenCalledWith("Tunnel closed");
  });

  it("reports close-tunnel API failures and request errors", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/close-tunnel`) {
        return okJson({ success: false, message: "Still open" });
      }
      return okJson({ experiment: {} });
    });
    const apiFailure = renderActions();

    await act(async () => {
      await apiFailure.result.current.handleCloseTunnel();
    });

    expect(apiFailure.props.setTunnelStatus).toHaveBeenCalledWith(
      "Error closing tunnel",
    );
    expect(console.error).toHaveBeenCalledWith("Still open");

    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/close-tunnel`) {
        throw new Error("close offline");
      }
      return okJson({ experiment: {} });
    });
    const requestFailure = renderActions();

    await act(async () => {
      await requestFailure.result.current.handleCloseTunnel();
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error closing tunnel:",
      expect.any(Error),
    );
  });

  it("does not close a local tunnel when confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    fetchMock().mockResolvedValue(
      okJson({ experiment: { tunnelUrl: "https://tunnel.test" } }),
    );
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleCloseTunnel();
    });

    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/close-tunnel`,
      expect.anything(),
    );
    expect(props.setTunnelStatus).not.toHaveBeenCalledWith(
      "Error closing tunnel",
    );
  });

  it("restores tunnel and pages URLs from local storage and the saved experiment", async () => {
    localStorage.setItem("tunnelActive", "true");
    localStorage.setItem("tunnelUrl", "https://stored-tunnel.test");
    fetchMock().mockResolvedValue(
      okJson({
        experiment: {
          tunnelUrl: "https://server-tunnel.test",
          pagesUrl: "https://pages.test/exp-123",
        },
      }),
    );
    const { props } = renderActions();

    await waitFor(() => {
      expect(props.setExperimentUrl).toHaveBeenCalledWith(
        "https://stored-tunnel.test/exp-123",
      );
    });
    await waitFor(() => {
      expect(props.setActiveTunnelUrl).toHaveBeenCalledWith(
        "https://server-tunnel.test",
      );
    });
    expect(props.setTunnelActive).toHaveBeenCalledWith(true);
    expect(props.setLastPagesUrl).toHaveBeenCalledWith(
      "https://pages.test/exp-123",
    );
  });

  it("clears stale local tunnel state when the saved experiment has no tunnel URL", async () => {
    localStorage.setItem("tunnelActive", "true");
    localStorage.setItem("tunnelUrl", "https://stored-tunnel.test");
    fetchMock().mockResolvedValue(okJson({ experiment: {} }));
    const { props } = renderActions();

    await waitFor(() => {
      expect(props.setActiveTunnelUrl).toHaveBeenCalledWith("");
    });

    expect(props.setTunnelActive).toHaveBeenCalledWith(false);
    expect(localStorage.getItem("tunnelActive")).toBeNull();
    expect(localStorage.getItem("tunnelUrl")).toBeNull();
  });

  it("ignores saved experiment responses without an experiment", async () => {
    fetchMock().mockResolvedValue(okJson({}));
    const { props } = renderActions();

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/experiment/exp-123`,
      );
    });

    expect(props.setActiveTunnelUrl).not.toHaveBeenCalled();
    expect(props.setLastPagesUrl).not.toHaveBeenCalled();
  });
});
