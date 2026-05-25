import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DevModeContext from "../../pages/ExperimentBuilder/contexts/DevModeContext";
import Actions from "../../pages/ExperimentBuilder/components/Timeline/Actions";
import PublishExperiment from "../../pages/ExperimentBuilder/components/Timeline/PublishExperiment";
import { useFileUpload } from "../../pages/ExperimentBuilder/components/Timeline/useFileUpload";
import type { UploadedFile } from "../../pages/ExperimentBuilder/components/Timeline/useFileUpload";
import { auth } from "../../lib/firebase";

const API_URL = "http://localhost:3000";

function okJson(payload: unknown, ok = true, status = ok ? 200 : 500): Response {
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

const initialFiles: UploadedFile[] = [
  { name: "first image.png", url: "uploads/img/first image.png", type: "img" },
  { name: "sound.mp3", url: "uploads/aud/sound.mp3", type: "aud" },
];

describe("Timeline file uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads uploaded files and reuses the in-memory folder cache", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    fetchMock().mockResolvedValue(okJson({ files: initialFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });

    act(() => {
      result.current.refreshUploadedFiles();
    });

    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/list-files/img/test-exp-123`,
    );
  });

  it("refreshes uploaded files after the cache expires", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: initialFiles }))
      .mockResolvedValueOnce(
        okJson({
          files: [
            ...initialFiles,
            { name: "new.png", url: "uploads/img/new.png", type: "img" },
          ],
        }),
      );

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });

    nowSpy.mockReturnValue(1_000 + 5 * 60 * 1000 + 1);

    act(() => {
      result.current.refreshUploadedFiles();
    });

    await waitFor(() => {
      expect(result.current.uploadedFiles).toHaveLength(3);
    });
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("uploads files, invalidates cache and reloads the folder listing", async () => {
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(okJson({ success: true }))
      .mockResolvedValueOnce(okJson({ files: initialFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["image"], "first image.png", { type: "image/png" });
    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/upload-files/test-exp-123`,
      {
        method: "POST",
        body: expect.any(FormData),
      },
    );
  });

  it("deletes one or many uploaded files and removes them from local state", async () => {
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: initialFiles }))
      .mockResolvedValue(okJson({ success: true }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });

    await act(async () => {
      await result.current.handleDeleteFile(initialFiles[0]);
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/delete-file/img/first%20image.png/test-exp-123`,
      { method: "DELETE" },
    );
    expect(result.current.uploadedFiles).toEqual([initialFiles[1]]);

    await act(async () => {
      await result.current.handleDeleteMultipleFiles([initialFiles[1]]);
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/delete-file/aud/sound.mp3/test-exp-123`,
      { method: "DELETE" },
    );
    expect(result.current.uploadedFiles).toEqual([]);
  });
});

describe("PublishExperiment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    (auth as any).currentUser = { uid: "user-123" };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    (auth as any).currentUser = null;
  });

  function createPublishHarness(overrides: Partial<Parameters<typeof PublishExperiment>[0]> = {}) {
    const props = {
      experimentID: "exp-123",
      setLastPagesUrl: vi.fn(),
      setPublishStatus: vi.fn(),
      getUserTokens: vi.fn(async () => ({
        drive: true,
        dropbox: false,
        osf: false,
        github: true,
      })),
      setAvailableStorages: vi.fn(),
      setShowStorageModal: vi.fn(),
      setIsPublishing: vi.fn(),
      generateExperiment: vi.fn(async () => "public-code"),
      ...overrides,
    };

    return { props, api: PublishExperiment(props) };
  }

  it("requires a logged-in user before publishing", async () => {
    (auth as any).currentUser = null;
    const { props, api } = createPublishHarness();

    await api.handlePublishToGitHub();

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: User not logged in",
    );
    expect(props.getUserTokens).not.toHaveBeenCalled();
  });

  it("opens storage selection when more than one connected storage exists", async () => {
    const { props, api } = createPublishHarness({
      getUserTokens: vi.fn(async () => ({
        drive: true,
        dropbox: true,
        osf: true,
        github: true,
      })),
    });

    await api.handlePublishToGitHub();

    expect(props.setAvailableStorages).toHaveBeenCalledWith([
      "googledrive",
      "dropbox",
      "osf",
    ]);
    expect(props.setShowStorageModal).toHaveBeenCalledWith(true);
    expect(props.generateExperiment).not.toHaveBeenCalled();
  });

  it("publishes directly with the only available storage and copies the pages URL", async () => {
    const writeText = installClipboard();
    fetchMock().mockResolvedValue(
      okJson({ success: true, pagesUrl: "https://pages.test/exp-123" }),
    );
    const { props, api } = createPublishHarness();

    await api.handlePublishToGitHub();

    expect(props.generateExperiment).toHaveBeenCalledWith("googledrive");
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/publish-experiment/exp-123`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: "user-123",
          storage: "googledrive",
          generatedPublicCode: "public-code",
        }),
        credentials: "include",
        mode: "cors",
      },
    );
    expect(props.setLastPagesUrl).toHaveBeenCalledWith(
      "https://pages.test/exp-123",
    );
    expect(writeText).toHaveBeenCalledWith("https://pages.test/exp-123");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });
});

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

  function renderActions(overrides: Partial<Parameters<typeof Actions>[0]> = {}, isDevMode = false) {
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
});
