import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionsActions from "../../../pages/ExperimentBuilder/components/ResultsList/SessionsActions";
import type {
  SessionMeta,
  TabType,
} from "../../../pages/ExperimentBuilder/components/ResultsList";

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((...segments: string[]) => segments.join("/")),
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: firestoreMocks.collection,
  getDocs: firestoreMocks.getDocs,
}));

const API_URL = "http://localhost:3000";

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: vi.fn(async () => payload),
    text: vi.fn(async () => "csv,data"),
  } as unknown as Response;
}

function okArrayBuffer(bytes: number[], ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    arrayBuffer: vi.fn(async () => new Uint8Array(bytes).buffer),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

const sessionsFixture: SessionMeta[] = [
  {
    _id: "preview-old",
    sessionId: "exp_result_old",
    createdAt: "2026-05-23T10:00:00.000Z",
    state: "completed",
  },
  {
    _id: "preview-new",
    sessionId: "exp_result_new",
    createdAt: "2026-05-24T10:00:00.000Z",
    state: "completed",
  },
  {
    _id: "local-1",
    sessionId: "local-1",
    createdAt: "2026-05-24T09:00:00.000Z",
    state: "completed",
    metadata: { browser: "Chrome" },
  },
  {
    _id: "online-1",
    sessionId: "online_1",
    createdAt: "2026-05-24T08:00:00.000Z",
    isOnline: true,
  },
];

function createProps(
  overrides: Partial<Parameters<typeof SessionsActions>[0]> = {},
) {
  return {
    experimentID: "exp-123",
    localActiveSessions: [],
    activeTab: "local" as TabType,
    selected: [],
    sessions: [],
    setSelected: vi.fn(),
    setLoading: vi.fn(),
    setOnlineLoading: vi.fn(),
    setSessions: vi.fn(),
    setSelectMode: vi.fn(),
    ...overrides,
  };
}

describe("SessionsActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === `${API_URL}/api/session-results/exp-123`) {
        return okJson({ sessions: sessionsFixture });
      }
      return okJson({ success: true });
    }) as unknown as typeof fetch;
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    (window as any).electron = {
      saveZipFile: vi.fn(async () => ({ success: true })),
      openExternal: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as any).electron;
  });

  it("does not delete selected sessions when empty or cancelled", async () => {
    const emptyProps = createProps({ selected: [] });
    const empty = renderHook(() => SessionsActions(emptyProps));

    await act(async () => {
      await empty.result.current.handleDeleteSelected();
    });

    expect(window.confirm).not.toHaveBeenCalledWith(
      "Delete 0 selected session(s)?",
    );

    const props = createProps({ selected: ["local-1"] });
    const { result } = renderHook(() => SessionsActions(props));
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/session-results/exp-123`,
      );
    });
    fetchMock().mockClear();
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    await act(async () => {
      await result.current.handleDeleteSelected();
    });

    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/session-results/local-1/exp-123`,
      expect.anything(),
    );
  });

  it("downloads selected local sessions as a ZIP through Electron", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/download-sessions-zip`) {
        return okArrayBuffer([1, 2, 3]);
      }
      return okJson({ sessions: [] });
    });
    const props = createProps({ selected: ["local-1"] });
    const { result } = renderHook(() => SessionsActions(props));

    await act(async () => {
      await result.current.handleDownloadSelected();
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/download-sessions-zip`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionIds: ["local-1"],
          experimentID: "exp-123",
        }),
      },
    );
    expect((window as any).electron.saveZipFile).toHaveBeenCalledWith(
      [1, 2, 3],
      "sessions.zip",
    );
    expect(window.alert).toHaveBeenCalledWith("ZIP saved successfully.");
  });

  it("does not download a ZIP when no local sessions are selected", async () => {
    const props = createProps({ selected: [] });
    const { result } = renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/session-results/exp-123`,
      );
    });
    fetchMock().mockClear();

    await act(async () => {
      await result.current.handleDownloadSelected();
    });

    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/download-sessions-zip`,
      expect.anything(),
    );
  });

  it("reports ZIP save failures and download errors", async () => {
    (window as any).electron.saveZipFile = vi.fn(async () => ({
      success: false,
      error: "disk full",
    }));
    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/download-sessions-zip`) {
        return okArrayBuffer([1, 2, 3]);
      }
      return okJson({ sessions: [] });
    });
    const props = createProps({ selected: ["local-1"] });
    const { result, rerender } = renderHook(
      (hookProps) => SessionsActions(hookProps),
      { initialProps: props },
    );

    await act(async () => {
      await result.current.handleDownloadSelected();
    });

    expect(window.alert).toHaveBeenCalledWith("Failed to save ZIP: disk full");

    (window as any).electron.saveZipFile = vi.fn(async () => ({
      success: false,
    }));

    await act(async () => {
      await result.current.handleDownloadSelected();
    });

    expect(window.alert).toHaveBeenCalledWith(
      "Failed to save ZIP: Unknown error",
    );

    fetchMock().mockImplementation(async (url: string) => {
      if (url === `${API_URL}/api/download-sessions-zip`) {
        return okArrayBuffer([], false);
      }
      return okJson({ sessions: [] });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    rerender(props);

    await act(async () => {
      await result.current.handleDownloadSelected();
    });

    expect(window.alert).toHaveBeenCalledWith(
      "Failed to download selected sessions",
    );
  });

  it("downloads an individual CSV and reports CSV download failures", async () => {
    const createObjectURL = vi.fn(() => "blob:session");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const props = createProps();
    const { result } = renderHook(() => SessionsActions(props));

    await act(async () => {
      await result.current.handleDownloadCSV("local-1");
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/download-session/local-1/exp-123`,
    );
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:session");

    fetchMock().mockResolvedValueOnce(okJson({}, false));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await result.current.handleDownloadCSV("local-1");
    });

    expect(window.alert).toHaveBeenCalledWith(
      "Failed to download session data",
    );
  });
});
