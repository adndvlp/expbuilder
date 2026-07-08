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
    const uploadBody = fetchMock().mock.calls[1][1]?.body as FormData;
    expect(uploadBody.get("compressOversizedMedia")).toBe("false");
  });

  it("asks to compress oversized media files and sends the compression flag", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(
        okJson({
          success: true,
          files: [
            {
              originalName: "blue.png",
              storedName: "blue.webp",
              url: "img/blue.webp",
              type: "img",
              compressed: true,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(okJson({ files: initialFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["image"], "blue.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("blue.png"),
    );
    const uploadBody = fetchMock().mock.calls[1][1]?.body as FormData;
    expect(uploadBody.get("compressOversizedMedia")).toBe("true");
  });

  it("refreshes converted media when the upload request is interrupted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const convertedFiles = [
      { name: "movie.webm", url: "vid/movie.webm", type: "vid" },
    ];
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okJson({ files: convertedFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "all" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["video"], "movie.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.uploadedFiles).toEqual(convertedFiles);
    expect(alertSpy).not.toHaveBeenCalledWith("Failed to fetch");
  });

  it("polls upload jobs and refreshes files after background conversion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const convertedFiles = [
      { name: "movie.webm", url: "vid/movie.webm", type: "vid" },
    ];
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(
        okJson(
          {
            success: true,
            processing: true,
            processingJobs: [{ id: "job-1", status: "processing" }],
          },
          true,
          202,
        ),
      )
      .mockResolvedValueOnce(
        okJson({
          success: true,
          job: { id: "job-1", status: "completed", warnings: [] },
        }),
      )
      .mockResolvedValueOnce(okJson({ files: convertedFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "all" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["video"], "movie.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/upload-jobs/job-1`,
    );
    expect(result.current.uploadedFiles).toEqual(convertedFiles);
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

  it("reports missing storage tokens before publishing", async () => {
    const { props, api } = createPublishHarness({
      getUserTokens: vi.fn(async () => ({
        drive: false,
        dropbox: false,
        osf: false,
        github: true,
      })),
    });

    await api.handlePublishToGitHub();

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Please connect Google Drive, Dropbox, or OSF in Settings",
    );
    expect(props.setAvailableStorages).not.toHaveBeenCalled();
    expect(props.generateExperiment).not.toHaveBeenCalled();
  });

  it("reports errors while preparing publish options", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { props, api } = createPublishHarness({
      getUserTokens: vi.fn(async () => {
        throw new Error("token lookup failed");
      }),
    });

    await api.handlePublishToGitHub();

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: token lookup failed",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error preparing to publish:",
      expect.any(Error),
    );
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

  it("does not call publish API when public code generation returns empty", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { props, api } = createPublishHarness({
      generateExperiment: vi.fn(async () => ""),
    });

    await api.publishWithStorage("user-123", "googledrive");

    expect(props.generateExperiment).toHaveBeenCalledWith("googledrive");
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Failed to generate public experiment code",
    );
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });

  it("reports HTTP failures from the publish endpoint", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockResolvedValue(okJson({ success: false }, false, 503));
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "dropbox");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Server responded with status: 503",
    );
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });

  it("shows GitHub file size publish errors from the API response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockResolvedValue(
      okJson(
        {
          success: false,
          code: "GITHUB_FILE_TOO_LARGE",
          message:
            "GitHub no acepta archivos mayores a 100 MiB: vid/demo.mp4 (142.3 MiB).",
          oversizedFiles: [
            {
              url: "vid/demo.mp4",
              filename: "demo.mp4",
              sizeBytes: 149_212_365,
            },
          ],
        },
        false,
        413,
      ),
    );
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "dropbox");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: GitHub no acepta archivos mayores a 100 MiB: vid/demo.mp4 (142.3 MiB).",
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(props.setPublishStatus).not.toHaveBeenCalledWith("");
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });

  it("warns when GitHub token is invalid", async () => {
    fetchMock().mockResolvedValue(
      okJson({
        success: false,
        message: "GitHub token not found or invalid",
      }),
    );
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "osf");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Warning: GitHub publish failed. Please reconnect your GitHub account in Settings.",
    );
    expect(props.setLastPagesUrl).not.toHaveBeenCalled();
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });

  it("keeps the pages URL when clipboard copy fails after publishing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installClipboard(vi.fn(async () => {
      throw new Error("clipboard denied");
    }));
    fetchMock().mockResolvedValue(
      okJson({ success: true, pagesUrl: "https://pages.test/exp-123" }),
    );
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "googledrive");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Published! GitHub Pages URL",
    );
    expect(props.setLastPagesUrl).toHaveBeenCalledWith(
      "https://pages.test/exp-123",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy GitHub Pages URL: ",
      expect.any(Error),
    );
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
    installClipboard(vi.fn(async () => {
      throw new Error("clipboard denied");
    }));
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
    expect(props.setExperimentUrl).toHaveBeenCalledWith(
      `${API_URL}/exp-123`,
    );
    expect(props.setActiveTunnelUrl).toHaveBeenCalledWith("");
    expect(props.setTunnelActive).toHaveBeenCalledWith(false);
    expect(localStorage.getItem("tunnelActive")).toBeNull();
    expect(localStorage.getItem("tunnelUrl")).toBeNull();
    expect(props.setTunnelStatus).toHaveBeenCalledWith("Tunnel closed");
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

  it("reports copy fallback states when there is no link or clipboard fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failingClipboard = installClipboard(vi.fn(async () => {
      throw new Error("clipboard denied");
    }));
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

    expect(failingClipboard).toHaveBeenCalledWith(
      "https://pages.test/exp-123",
    );
    expect(pages.props.setPagesCopyStatus).toHaveBeenCalledWith(
      "Failed to copy link.",
    );
  });
});
