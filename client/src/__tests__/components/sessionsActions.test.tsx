import { act, renderHook, waitFor } from "@testing-library/react";
import { getDocs } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionsActions from "../../pages/ExperimentBuilder/components/ResultsList/SessionsActions";
import type {
  SessionMeta,
  TabType,
} from "../../pages/ExperimentBuilder/components/ResultsList";

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

function createProps(overrides: Partial<Parameters<typeof SessionsActions>[0]> = {}) {
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

  it("loads preview sessions and sorts newest results first", async () => {
    const props = createProps({ activeTab: "preview" });

    renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(props.setSessions).toHaveBeenCalledWith([
        sessionsFixture[1],
        sessionsFixture[0],
      ]);
    });
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/session-results/exp-123`,
    );
    expect(props.setSelected).toHaveBeenCalledWith([]);
    expect(props.setSelectMode).toHaveBeenCalledWith(false);
  });

  it("merges active local websocket sessions over local DB sessions", async () => {
    const activeLocal: SessionMeta[] = [
      {
        _id: "active-local-1",
        sessionId: "local-1",
        createdAt: "2026-05-24T09:00:00.000Z",
        state: "in-progress",
        metadata: { os: "macOS" },
      },
      {
        _id: "active-local-2",
        sessionId: "local-2",
        createdAt: "2026-05-24T11:00:00.000Z",
        state: "initiated",
      },
    ];
    const props = createProps({
      activeTab: "local",
      localActiveSessions: activeLocal,
    });

    renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(props.setSessions).toHaveBeenCalledWith([
        activeLocal[1],
        {
          ...sessionsFixture[2],
          state: "in-progress",
          metadata: { browser: "Chrome", os: "macOS" },
        },
      ]);
    });
  });

  it("lazy-loads online sessions from Firestore when the online tab opens", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: "online-doc-1",
          data: () => ({
            sessionId: "online-session-1",
            createdAt: "2026-05-24T12:00:00.000Z",
            state: "completed",
            metadata: { browser: "Firefox" },
            fileUrl: "https://storage.test/session.csv",
          }),
        },
      ],
    } as any);
    const props = createProps({ activeTab: "online" });

    renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(props.setOnlineLoading).toHaveBeenCalledWith(false);
      expect(props.setSessions).toHaveBeenCalledWith([
        {
          _id: "online-doc-1",
          sessionId: "online-session-1",
          createdAt: "2026-05-24T12:00:00.000Z",
          state: "completed",
          metadata: { browser: "Firefox" },
          fileUrl: "https://storage.test/session.csv",
        },
      ]);
    });
  });

  it("uses fallback metadata while loading and sorting online sessions", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: "online-completed-at",
          data: () => ({
            completedAt: "2026-05-24T12:00:00.000Z",
          }),
        },
        {
          id: "online-defaults",
          data: () => ({}),
        },
      ],
    } as any);
    const props = createProps({ activeTab: "online" });

    renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(props.setSessions).toHaveBeenCalledWith([
        {
          _id: "online-defaults",
          sessionId: "online-defaults",
          createdAt: expect.any(String),
          state: "completed",
          metadata: {},
          fileUrl: undefined,
        },
        {
          _id: "online-completed-at",
          sessionId: "online-completed-at",
          createdAt: "2026-05-24T12:00:00.000Z",
          state: "completed",
          metadata: {},
          fileUrl: undefined,
        },
      ]);
    });
  });

  it("skips online session loading and participant files without an experiment id", async () => {
    const props = createProps({ activeTab: "online", experimentID: undefined });
    const { result } = renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(props.setSessions).toHaveBeenCalledWith([]);
    });

    await expect(
      result.current.fetchOnlineSessionFiles("online-session-1"),
    ).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
    expect(props.setOnlineLoading).not.toHaveBeenCalledWith(true);
  });

  it("handles local session fetch failures and empty payloads", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockRejectedValueOnce(new Error("local fetch failed"));
    const props = createProps();

    renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error fetching sessions:",
        expect.any(Error),
      );
      expect(props.setLoading).toHaveBeenCalledWith(false);
    });

    fetchMock().mockResolvedValueOnce(okJson({}));
    const emptyProps = createProps({ activeTab: "preview" });
    renderHook(() => SessionsActions(emptyProps));

    await waitFor(() => {
      expect(emptyProps.setSessions).toHaveBeenCalledWith([]);
    });
  });

  it("toggles individual and all session selection", () => {
    const props = createProps({
      selected: ["local-1"],
      sessions: [sessionsFixture[2], { ...sessionsFixture[2], sessionId: "local-2" }],
    });
    const { result } = renderHook(() => SessionsActions(props));

    act(() => {
      result.current.toggleSelect("local-1");
    });

    const removeUpdater = props.setSelected.mock.calls.at(-1)?.[0];
    expect(removeUpdater(["local-1", "local-2"])).toEqual(["local-2"]);

    act(() => {
      result.current.toggleSelect("local-3");
    });

    const addUpdater = props.setSelected.mock.calls.at(-1)?.[0];
    expect(addUpdater(["local-1"])).toEqual(["local-1", "local-3"]);

    act(() => {
      result.current.toggleSelectAll();
    });

    expect(props.setSelected).toHaveBeenLastCalledWith([
      "local-1",
      "local-2",
    ]);
  });

  it("clears select all when everything is selected and cancels select mode", () => {
    const props = createProps({
      selected: ["local-1", "local-2"],
      sessions: [sessionsFixture[2], { ...sessionsFixture[2], sessionId: "local-2" }],
    });
    const { result } = renderHook(() => SessionsActions(props));

    act(() => {
      result.current.toggleSelectAll();
      result.current.handleCancelSelect();
    });

    expect(props.setSelected).toHaveBeenCalledWith([]);
    expect(props.setSelectMode).toHaveBeenCalledWith(false);
  });

  it("deletes one local session only after confirmation", async () => {
    const props = createProps();
    const { result } = renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/session-results/exp-123`,
      );
    });
    fetchMock().mockClear();

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await act(async () => {
      await result.current.handleDeleteSession("local-1");
    });

    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/session-results/local-1/exp-123`,
      expect.anything(),
    );

    vi.mocked(window.confirm).mockReturnValueOnce(true);
    await act(async () => {
      await result.current.handleDeleteSession("local-1");
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/session-results/local-1/exp-123`,
      { method: "DELETE" },
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/session-results/exp-123`,
    );
  });

  it("logs individual delete failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const props = createProps();
    const { result } = renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/session-results/exp-123`,
      );
    });
    fetchMock().mockClear();
    fetchMock().mockRejectedValueOnce(new Error("delete failed"));

    await act(async () => {
      await result.current.handleDeleteSession("local-1");
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error deleting session:",
      expect.any(Error),
    );
  });

  it("deletes selected local sessions and refreshes the list", async () => {
    const props = createProps({ selected: ["local-1", "local-2"] });
    const { result } = renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/session-results/exp-123`,
      );
    });
    fetchMock().mockClear();

    await act(async () => {
      await result.current.handleDeleteSelected();
    });

    expect(window.confirm).toHaveBeenCalledWith(
      "Delete 2 selected session(s)?",
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/session-results/local-1/exp-123`,
      { method: "DELETE" },
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/session-results/local-2/exp-123`,
      { method: "DELETE" },
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/session-results/exp-123`,
    );
  });

  it("logs selected delete failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const props = createProps({ selected: ["local-1"] });
    const { result } = renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/session-results/exp-123`,
      );
    });
    fetchMock().mockClear();
    fetchMock().mockRejectedValueOnce(new Error("delete selected failed"));

    await act(async () => {
      await result.current.handleDeleteSelected();
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error deleting sessions:",
      expect.any(Error),
    );
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

    expect(window.alert).toHaveBeenCalledWith(
      "Failed to save ZIP: disk full",
    );

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

  it("opens selected online session file URLs with a stagger", () => {
    vi.useFakeTimers();
    const props = createProps({
      selected: ["online-1", "online-2"],
      sessions: [
        {
          _id: "online-1",
          sessionId: "online-1",
          createdAt: "2026-05-24T10:00:00.000Z",
          fileUrl: "https://storage.test/one.csv",
        },
        {
          _id: "online-2",
          sessionId: "online-2",
          createdAt: "2026-05-24T10:05:00.000Z",
          fileUrl: "https://storage.test/two.csv",
        },
      ],
    });
    const { result } = renderHook(() => SessionsActions(props));

    act(() => {
      result.current.handleDownloadSelectedOnline();
    });

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect((window as any).electron.openExternal).toHaveBeenCalledWith(
      "https://storage.test/one.csv",
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect((window as any).electron.openExternal).toHaveBeenCalledWith(
      "https://storage.test/two.csv",
    );
  });

  it("refreshes online and local sessions on demand", async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);
    const onlineProps = createProps({ activeTab: "online" });
    const online = renderHook(() => SessionsActions(onlineProps));

    await waitFor(() => {
      expect(onlineProps.setOnlineLoading).toHaveBeenCalledWith(false);
    });
    vi.mocked(getDocs).mockClear();

    await act(async () => {
      online.result.current.handleRefresh();
    });

    expect(getDocs).toHaveBeenCalled();

    const localProps = createProps({ activeTab: "local" });
    const local = renderHook(() => SessionsActions(localProps));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/session-results/exp-123`,
      );
    });
    fetchMock().mockClear();

    await act(async () => {
      local.result.current.handleRefresh();
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/session-results/exp-123`,
    );
  });

  it("maps online participant files and their fallback fields", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        {
          id: "file-doc",
          data: () => ({
            fileId: "file-1",
            sessionId: "online-session-1",
            filename: "data.csv",
            originalName: "original.csv",
            mimeType: "text/csv",
            sizeBytes: 42,
            uploadedAt: "2026-05-24T12:30:00.000Z",
            url: "https://storage.test/data.csv",
          }),
        },
        {
          id: "fallback-doc",
          data: () => ({}),
        },
      ],
    } as any);
    const props = createProps();
    const { result } = renderHook(() => SessionsActions(props));

    await expect(
      result.current.fetchOnlineSessionFiles("online-session-1"),
    ).resolves.toEqual([
      {
        id: "file-1",
        sessionId: "online-session-1",
        filename: "data.csv",
        originalName: "original.csv",
        mimeType: "text/csv",
        sizeBytes: 42,
        uploadedAt: "2026-05-24T12:30:00.000Z",
        url: "https://storage.test/data.csv",
      },
      {
        id: "fallback-doc",
        sessionId: null,
        filename: "",
        originalName: "fallback-doc",
        mimeType: "",
        sizeBytes: 0,
        uploadedAt: expect.any(String),
        url: "",
      },
    ]);
  });

  it("handles online session and online participant-file fetch errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getDocs).mockRejectedValue(new Error("firestore offline"));
    const props = createProps({ activeTab: "online" });
    const { result } = renderHook(() => SessionsActions(props));

    await waitFor(() => {
      expect(props.setOnlineLoading).toHaveBeenCalledWith(false);
    });
    expect(props.setSessions).toHaveBeenCalledWith([]);
    expect(console.error).toHaveBeenCalledWith(
      "Error fetching online session metadata from Firestore:",
      expect.any(Error),
    );

    await expect(
      result.current.fetchOnlineSessionFiles("online-session-1"),
    ).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "Error fetching online participant files:",
      expect.any(Error),
    );
  });
});
