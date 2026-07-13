import { act, renderHook } from "@testing-library/react";
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

  it("skips saved experiment lookup when experimentID is unavailable", () => {
    renderActions({ experimentID: undefined });

    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/experiment/undefined`,
    );
  });

  it("copies the latest GitHub Pages URL before tunnel URLs", async () => {
    const { result, props } = renderActions({
      lastPagesUrl: "https://pages.test/exp-123",
      isTunnelActive: true,
    });
    localStorage.setItem("tunnelUrl", "https://tunnel.test");

    await act(async () => {
      await result.current.handleCopyLink();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://pages.test/exp-123",
    );
    expect(props.setPagesCopyStatus).toHaveBeenCalledWith("Link copied!");
    expect(props.setTunnelCopyStatus).not.toHaveBeenCalledWith("Link copied!");
  });

  it("copies the active tunnel URL when there is no pages URL", async () => {
    const { result, props } = renderActions({
      isTunnelActive: true,
    });
    localStorage.setItem("tunnelUrl", "https://tunnel.test");

    await act(async () => {
      await result.current.handleCopyLink();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://tunnel.test/exp-123",
    );
    expect(props.setTunnelCopyStatus).toHaveBeenCalledWith("Link copied!");
  });

  it("reports no link when an active tunnel has no persisted URL", async () => {
    const { result, props } = renderActions({ isTunnelActive: true });

    await act(async () => {
      await result.current.handleCopyLink();
    });

    expect(props.setTunnelCopyStatus).toHaveBeenCalledWith(
      "No published link available.",
    );
  });

  it("reports copy fallback states when there is no link or clipboard fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failingClipboard = installClipboard(
      vi.fn(async () => {
        throw new Error("clipboard denied");
      }),
    );
    const noLink = renderActions();

    await act(async () => {
      await noLink.result.current.handleCopyLink();
    });

    expect(noLink.props.setTunnelCopyStatus).toHaveBeenCalledWith(
      "No published link available.",
    );

    const pages = renderActions({
      lastPagesUrl: "https://pages.test/exp-123",
    });

    await act(async () => {
      await pages.result.current.handleCopyLink();
    });

    expect(failingClipboard).toHaveBeenCalledWith("https://pages.test/exp-123");
    expect(pages.props.setPagesCopyStatus).toHaveBeenCalledWith(
      "Failed to copy link.",
    );
  });

  it("clears successful tunnel, close and copy statuses after their timers", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/create-tunnel`) {
        return okJson({ success: true, url: "https://tunnel.test" });
      }
      if (url === `${API_URL}/api/close-tunnel`) {
        return okJson({ success: true, message: "Tunnel closed" });
      }
      return okJson({ experiment: {} });
    });
    const tunnel = renderActions({ isTunnelActive: true });

    await act(async () => {
      await tunnel.result.current.handleShareLocalExperiment();
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(tunnel.props.setTunnelStatus).toHaveBeenCalledWith("");

    await act(async () => {
      await tunnel.result.current.handleCloseTunnel();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(tunnel.props.setTunnelStatus).toHaveBeenCalledWith("");

    localStorage.setItem("tunnelUrl", "https://tunnel.test");
    await act(async () => {
      await tunnel.result.current.handleCopyLink();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(tunnel.props.setTunnelCopyStatus).toHaveBeenCalledWith("");

    const noLink = renderActions();
    await act(async () => {
      await noLink.result.current.handleCopyLink();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(noLink.props.setTunnelCopyStatus).toHaveBeenCalledWith("");
  });
});
