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

  it("toggles individual and all session selection", () => {
    const props = createProps({
      selected: ["local-1"],
      sessions: [
        sessionsFixture[2],
        { ...sessionsFixture[2], sessionId: "local-2" },
      ],
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

    expect(props.setSelected).toHaveBeenLastCalledWith(["local-1", "local-2"]);
  });

  it("clears select all when everything is selected and cancels select mode", () => {
    const props = createProps({
      selected: ["local-1", "local-2"],
      sessions: [
        sessionsFixture[2],
        { ...sessionsFixture[2], sessionId: "local-2" },
      ],
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
});
