import { renderHook, waitFor } from "@testing-library/react";
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
});
