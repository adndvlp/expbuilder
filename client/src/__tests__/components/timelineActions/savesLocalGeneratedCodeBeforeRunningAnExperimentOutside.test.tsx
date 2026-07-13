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

  it("saves local generated code before running an experiment outside dev mode", async () => {
    const { result, props, setCode } = renderActions();

    await act(async () => {
      await result.current.handleRunExperiment();
    });

    expect(props.generateLocalExperiment).toHaveBeenCalled();
    expect(props.generatedBaseCode).toHaveBeenCalled();
    expect(setCode).toHaveBeenCalledWith("base-code");
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/save-config/exp-123`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { generatedCode: "local-code" },
          isDevMode: false,
        }),
        credentials: "include",
        mode: "cors",
      },
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/run-experiment/exp-123`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedCode: "local-code" }),
        credentials: "include",
        mode: "cors",
      },
    );
    expect(props.setSubmitStatus).toHaveBeenCalledWith("Experiment ready!");
    expect(props.setIsSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("runs experiments in dev mode without saving config first", async () => {
    const { result, props } = renderActions({}, true);

    await act(async () => {
      await result.current.handleRunExperiment();
    });

    expect(props.generatedBaseCode).not.toHaveBeenCalled();
    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/save-config/exp-123`,
      expect.anything(),
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/run-experiment/exp-123`,
      expect.any(Object),
    );
  });

  it("stops before running when saved config returns success false", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/experiment/exp-123`) {
        return okJson({ experiment: {} });
      }
      if (url === `${API_URL}/api/save-config/exp-123`) {
        return okJson({ success: false });
      }
      return okJson({ success: true });
    });
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleRunExperiment();
    });

    expect(props.setSubmitStatus).toHaveBeenCalledWith(
      "Failed to save configuration.",
    );
    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/run-experiment/exp-123`,
      expect.anything(),
    );
    expect(props.setIsSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("reports failed run responses after a successful save", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/experiment/exp-123`) {
        return okJson({ experiment: {} });
      }
      if (url === `${API_URL}/api/save-config/exp-123`) {
        return okJson({ success: true });
      }
      if (url === `${API_URL}/api/run-experiment/exp-123`) {
        return okJson({ success: false });
      }
      return okJson({ success: true });
    });
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleRunExperiment();
    });

    expect(props.setSubmitStatus).toHaveBeenCalledWith(
      "Saved configuration but failed at running the experiment.",
    );
    expect(window.alert).toHaveBeenCalledWith(
      "Saved configuration but failed at running the experiment.",
    );
    expect(props.setIsSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("surfaces server errors while running an experiment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/experiment/exp-123`) {
        return okJson({ experiment: {} });
      }
      if (url === `${API_URL}/api/save-config/exp-123`) {
        return okJson({ success: true });
      }
      if (url === `${API_URL}/api/run-experiment/exp-123`) {
        return okJson({ success: false }, false, 502);
      }
      return okJson({ success: true });
    });
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleRunExperiment();
    });

    expect(props.setSubmitStatus).toHaveBeenCalledWith(
      "An error occurred: Server responded with status: 502 when running experiment",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error submitting configuration:",
      expect.any(Error),
    );
  });

  it("surfaces save-config HTTP errors before running an experiment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/experiment/exp-123`) {
        return okJson({ experiment: {} });
      }
      if (url === `${API_URL}/api/save-config/exp-123`) {
        return okJson({ success: false }, false, 503);
      }
      return okJson({ success: true });
    });
    const { result, props } = renderActions();

    await act(async () => {
      await result.current.handleRunExperiment();
    });

    expect(props.setSubmitStatus).toHaveBeenCalledWith(
      "An error occurred: Server responded with status: 503",
    );
    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/run-experiment/exp-123`,
      expect.anything(),
    );
  });
});
