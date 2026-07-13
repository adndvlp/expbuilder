import { act, renderHook, waitFor } from "@testing-library/react";
import { getDocs } from "firebase/firestore";
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
