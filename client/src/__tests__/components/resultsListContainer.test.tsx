import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResultsList from "../../pages/ExperimentBuilder/components/ResultsList";

const mocks = vi.hoisted(() => ({
  socketHandlers: {} as Record<string, (...args: any[]) => void>,
  socketEmit: vi.fn(),
  socketDisconnect: vi.fn(),
  experimentID: "exp-123" as string | null,
  collection: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  getDocs: vi.fn(),
  openExternal: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      mocks.socketHandlers[event] = callback;
    }),
    emit: mocks.socketEmit,
    disconnect: mocks.socketDisconnect,
  })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mocks.collection,
  getDocs: mocks.getDocs,
}));

vi.mock("../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => mocks.experimentID,
}));

vi.mock("react-switch", () => ({
  default: ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label="toggle switch"
      data-checked={String(checked)}
      onClick={() => onChange(!checked)}
    />
  ),
}));

function okJson(payload: unknown): Response {
  return {
    ok: true,
    json: vi.fn(async () => payload),
    text: vi.fn(async () => "csv,data"),
    arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  } as unknown as Response;
}

const sessionsFixture = [
  {
    _id: "preview-1",
    sessionId: "exp_result_preview",
    createdAt: "2026-05-24T08:00:00.000Z",
    state: "completed",
  },
  {
    _id: "local-1",
    sessionId: "local-1",
    createdAt: "2026-05-24T10:00:00.000Z",
    state: "completed",
    metadata: {
      browser: "Chrome",
      browserVersion: "125",
      os: "macOS",
      screenResolution: "1440x900",
    },
  },
  {
    _id: "online-db",
    sessionId: "online_1",
    createdAt: "2026-05-24T09:00:00.000Z",
    state: "completed",
    isOnline: true,
  },
];

const localFiles = [
  {
    id: "file-1",
    sessionId: "local-1",
    filename: "response.png",
    originalName: "response.png",
    mimeType: "image/png",
    sizeBytes: 2048,
    uploadedAt: "2026-05-24T10:01:00.000Z",
    url: "/files/response.png",
  },
];

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

describe("ResultsList container", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.socketHandlers = {};
    mocks.experimentID = "exp-123";
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "http://localhost:3000/api/session-results/exp-123") {
        return okJson({ sessions: sessionsFixture });
      }
      if (url === "http://localhost:3000/api/participant-files/exp-123") {
        return okJson(localFiles);
      }
      if (
        url ===
        "http://localhost:3000/api/participant-files/exp-123?sessionId=local-1"
      ) {
        return okJson(localFiles);
      }
      if (
        url ===
          "http://localhost:3000/api/participant-files/exp-123/file-1" &&
        init?.method === "DELETE"
      ) {
        return okJson({ success: true });
      }
      if (url === "http://localhost:3000/api/download-sessions-zip") {
        return okJson({ success: true });
      }
      if (
        String(url).startsWith(
          "http://localhost:3000/api/session-results/local-1/exp-123",
        ) &&
        init?.method === "DELETE"
      ) {
        return okJson({ success: true });
      }
      return okJson({ success: true });
    }) as unknown as typeof fetch;
    mocks.getDocs.mockImplementation(async (collectionPath: string) => {
      if (String(collectionPath).includes("participant_files")) {
        return {
          docs: [
            {
              id: "online-file-1",
              data: () => ({
                fileId: "online-file-1",
                sessionId: "online-session-1",
                filename: "online-upload.txt",
                originalName: "online-upload.txt",
                mimeType: "text/plain",
                sizeBytes: 1024,
                uploadedAt: "2026-05-24T12:01:00.000Z",
                url: "https://storage.test/online-upload.txt",
              }),
            },
          ],
        };
      }

      return {
        docs: [
          {
            id: "online-doc-1",
            data: () => ({
              sessionId: "online-session-1",
              createdAt: "2026-05-24T12:00:00.000Z",
              state: "completed",
              metadata: {
                browser: "Firefox",
                os: "Windows",
                screenResolution: "1920x1080",
              },
              fileUrl: "https://storage.test/session.csv",
            }),
          },
        ],
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders local sessions, merges websocket updates, and manages participant files", async () => {
    const { unmount } = render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();
    expect(screen.queryByText("exp_result_preview")).not.toBeInTheDocument();
    expect(screen.queryByText("online_1")).not.toBeInTheDocument();
    act(() => {
      mocks.socketHandlers.connect?.();
    });
    expect(mocks.socketEmit).toHaveBeenCalledWith("listen-experiment", "exp-123");
    act(() => {
      mocks.socketHandlers.disconnect?.();
    });
    expect(console.log).toHaveBeenCalledWith("WebSocket disconnected");

    act(() => {
      mocks.socketHandlers["session-update"]?.({
        experimentID: "another-experiment",
        sessions: [
          {
            _id: "ignored-session",
            sessionId: "ignored-session",
            createdAt: "2026-05-24T11:00:00.000Z",
          },
        ],
      });
    });
    expect(screen.queryByText("ignored-session")).not.toBeInTheDocument();

    act(() => {
      mocks.socketHandlers["session-update"]?.({
        experimentID: "exp-123",
        sessions: [
          {
            _id: "active-local-2",
            sessionId: "local-2",
            createdAt: "2026-05-24T12:00:00.000Z",
            state: "initiated",
            metadata: { browser: "Safari", os: "iOS" },
          },
          {
            _id: "active-local-1",
            sessionId: "local-1",
            createdAt: "2026-05-24T10:00:00.000Z",
            state: "in-progress",
            metadata: { os: "macOS 15" },
          },
        ],
      });
    });

    expect(await screen.findByText("local-2")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Files (1)")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Files (1)"));

    expect(await screen.findByText("response.png")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Delete file"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/participant-files/exp-123/file-1",
        { method: "DELETE" },
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("response.png")).not.toBeInTheDocument();
    });

    unmount();
    expect(mocks.socketDisconnect).toHaveBeenCalled();
  });

  it("skips websocket setup when the experiment id is unavailable", () => {
    mocks.experimentID = null;

    render(<ResultsList activeTab="local" />);

    expect(mocks.socketHandlers).toEqual({});
    expect(mocks.socketEmit).not.toHaveBeenCalled();
  });

  it("ignores participant file preload failures", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/session-results/exp-123") {
        return okJson({ sessions: sessionsFixture });
      }
      if (url === "http://localhost:3000/api/participant-files/exp-123") {
        throw new Error("preload failed");
      }
      return okJson({ success: true });
    });

    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/participant-files/exp-123",
      );
    });
  });

  it("renders online sessions from Firestore, opens result files, and expands uploaded files", async () => {
    render(<ResultsList activeTab="online" />);

    expect(await screen.findByText("online-session-1")).toBeInTheDocument();
    expect(screen.getByText("Firefox")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Download"));
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://storage.test/session.csv",
    );

    fireEvent.click(screen.getByRole("button", { name: "Files" }));

    expect(await screen.findByText("online-upload.txt")).toBeInTheDocument();
    expect(mocks.collection).toHaveBeenCalledWith(
      {},
      "experiments",
      "exp-123",
      "session_metadata",
      "online-session-1",
      "participant_files",
    );

    fireEvent.click(screen.getByText("↻ Refresh"));
    await waitFor(() => {
      expect(mocks.getDocs).toHaveBeenCalledTimes(3);
    });
  });

  it("renders preview sessions separately from local and online sessions", async () => {
    render(<ResultsList activeTab="preview" />);

    expect(await screen.findByText("exp_result_preview")).toBeInTheDocument();
    expect(screen.queryByText("local-1")).not.toBeInTheDocument();
    expect(screen.queryByText("online_1")).not.toBeInTheDocument();
    expect(screen.getByText("Preview Results")).toBeInTheDocument();
  });

  it("filters local sessions and clears active filters", async () => {
    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();

    act(() => {
      mocks.socketHandlers["session-update"]?.({
        experimentID: "exp-123",
        sessions: [
          {
            _id: "active-local-2",
            sessionId: "local-2",
            createdAt: "2026-05-24T12:00:00.000Z",
            state: "initiated",
            metadata: {
              browser: "Safari",
              os: "iOS",
              screenResolution: "390x844",
            },
          },
        ],
      });
    });

    expect(await screen.findByText("local-2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Filter"));
    fireEvent.change(screen.getByLabelText("Browser"), {
      target: { value: "Safari" },
    });

    expect(screen.getByText("local-2")).toBeInTheDocument();
    expect(screen.queryByText("local-1")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear all"));

    expect(await screen.findByText("local-1")).toBeInTheDocument();
    expect(screen.getByText("local-2")).toBeInTheDocument();
  });

  it("filters local sessions by mismatched OS, resolution, and 90-day window", async () => {
    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();

    act(() => {
      mocks.socketHandlers["session-update"]?.({
        experimentID: "exp-123",
        sessions: [
          {
            _id: "active-recent",
            sessionId: "local-recent",
            createdAt: "2026-07-09T12:00:00.000Z",
            state: "completed",
            metadata: {
              browser: "Safari",
              os: "iOS",
              screenResolution: "390x844",
            },
          },
          {
            _id: "active-old",
            sessionId: "local-old",
            createdAt: "2025-01-01T12:00:00.000Z",
            state: "completed",
            metadata: {
              browser: "Firefox",
              os: "Linux",
              screenResolution: "800x600",
            },
          },
        ],
      });
    });

    expect(await screen.findByText("local-recent")).toBeInTheDocument();
    expect(screen.getByText("local-old")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Filter"));
    fireEvent.change(screen.getByLabelText("OS"), {
      target: { value: "iOS" },
    });

    expect(screen.getByText("local-recent")).toBeInTheDocument();
    expect(screen.queryByText("local-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear all"));
    fireEvent.change(screen.getByLabelText("Resolution"), {
      target: { value: "390x844" },
    });

    expect(screen.getByText("local-recent")).toBeInTheDocument();
    expect(screen.queryByText("local-old")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear all"));
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "90d" },
    });

    expect(screen.getByText("local-recent")).toBeInTheDocument();
    expect(screen.queryByText("local-old")).not.toBeInTheDocument();
  });

  it("closes the filter dropdown and applies state, OS, resolution, and date filters", async () => {
    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();

    act(() => {
      mocks.socketHandlers["session-update"]?.({
        experimentID: "exp-123",
        sessions: [
          {
            _id: "active-local-abandoned",
            sessionId: "local-abandoned",
            createdAt: "2026-05-24T12:00:00.000Z",
            state: "abandoned",
            metadata: {
              browser: "Safari",
              os: "iOS",
              screenResolution: "390x844",
            },
          },
          {
            _id: "active-local-nostate",
            sessionId: "local-no-state",
            createdAt: "2026-05-20T12:00:00.000Z",
            metadata: {
              browser: "Firefox",
              os: "Linux",
              screenResolution: "1366x768",
            },
          },
        ],
      });
    });

    expect(await screen.findByText("local-abandoned")).toBeInTheDocument();
    expect(screen.getByText("Abandoned")).toBeInTheDocument();
    expect(screen.getByText("local-no-state")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Filter"));
    expect(screen.getByText("Filter sessions")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Filter"));
    expect(screen.queryByText("Filter sessions")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Filter"));
    fireEvent.mouseDown(screen.getByText("Filter sessions"));
    expect(screen.getByText("Filter sessions")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("State"), {
      target: { value: "abandoned" },
    });
    fireEvent.change(screen.getByLabelText("OS"), {
      target: { value: "iOS" },
    });
    fireEvent.change(screen.getByLabelText("Resolution"), {
      target: { value: "390x844" },
    });

    expect(screen.getByText("local-abandoned")).toBeInTheDocument();
    expect(screen.queryByText("local-no-state")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "today" },
    });
    expect(
      await screen.findByText("No sessions match the current filters."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "yesterday" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "7d" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "30d" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "90d" },
    });

    fireEvent.click(screen.getByText("Clear all"));
    expect(await screen.findByText("local-no-state")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Filter sessions")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Filter"));
    const closeButton = screen
      .getByText("Filter sessions")
      .parentElement?.querySelector("button");
    fireEvent.click(closeButton!);

    expect(screen.queryByText("Filter sessions")).not.toBeInTheDocument();
  });

  it("keeps only yesterday's sessions and renders unknown state and metadata fallbacks", async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();

    act(() => {
      mocks.socketHandlers["session-update"]?.({
        experimentID: "exp-123",
        sessions: [
          {
            _id: "unknown-yesterday",
            sessionId: "unknown-yesterday",
            createdAt: yesterday.toISOString(),
            state: "unexpected",
          },
          {
            _id: "completed-today",
            sessionId: "completed-today",
            createdAt: today.toISOString(),
            state: "completed",
          },
        ],
      });
    });

    expect(await screen.findByText("unknown-yesterday")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByText("Filter"));
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "yesterday" },
    });

    expect(screen.getByText("unknown-yesterday")).toBeInTheDocument();
    expect(screen.queryByText("completed-today")).not.toBeInTheDocument();
  });

  it("shows the local file loading state while the request is pending", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/session-results/exp-123") {
        return okJson({ sessions: sessionsFixture });
      }
      if (String(url).includes("/api/participant-files/exp-123")) {
        return new Promise<Response>(() => {});
      }
      return okJson({ success: true });
    });

    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Files" }));

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("formats local participant file sizes in megabytes", async () => {
    const largeFile = { ...localFiles[0], sizeBytes: 2 * 1024 * 1024 };
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/session-results/exp-123") {
        return okJson({ sessions: sessionsFixture });
      }
      if (String(url).includes("/api/participant-files/exp-123")) {
        return okJson([largeFile]);
      }
      return okJson({ success: true });
    });

    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Files (1)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Files (1)" }));

    expect(await screen.findByText("2.0 MB")).toBeInTheDocument();
  });

  it("renders online sessions without metadata, files, or a result URL", async () => {
    mocks.getDocs.mockImplementation(async (collectionPath: string) => {
      if (String(collectionPath).includes("participant_files")) {
        return { docs: [] };
      }
      return {
        docs: [
          {
            id: "online-empty-doc",
            data: () => ({
              sessionId: "online-empty",
              createdAt: "2026-05-24T12:00:00.000Z",
              state: "completed",
            }),
          },
        ],
      };
    });

    render(<ResultsList activeTab="online" />);

    expect(await screen.findByText("online-empty")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(4);
    fireEvent.click(screen.getByRole("button", { name: "Files" }));

    expect(await screen.findByText("No files")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "▲ Close" }));
    expect(screen.getByRole("button", { name: "Files (0)" })).toBeInTheDocument();
  });

  it("formats online participant file sizes in megabytes", async () => {
    mocks.getDocs.mockImplementation(async (collectionPath: string) => {
      if (String(collectionPath).includes("participant_files")) {
        return {
          docs: [
            {
              id: "large-online-file",
              data: () => ({
                fileId: "large-online-file",
                sessionId: "online-large",
                filename: "large.bin",
                originalName: "large.bin",
                mimeType: "application/octet-stream",
                sizeBytes: 3 * 1024 * 1024,
                uploadedAt: "2026-05-24T12:01:00.000Z",
                url: "https://storage.test/large.bin",
              }),
            },
          ],
        };
      }
      return {
        docs: [
          {
            id: "online-large-doc",
            data: () => ({
              sessionId: "online-large",
              createdAt: "2026-05-24T12:00:00.000Z",
              state: "completed",
            }),
          },
        ],
      };
    });

    render(<ResultsList activeTab="online" />);

    expect(await screen.findByText("online-large")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Files" }));

    expect(await screen.findByText("3.0 MB")).toBeInTheDocument();
  });

  it("handles local file fetch failures and row-level CSV and delete actions", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:csv"),
      revokeObjectURL: vi.fn(),
    });

    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Files (1)")).toBeInTheDocument();
    });

    fetchMock().mockImplementation(async (url: string, init?: RequestInit) => {
      if (
        url ===
        "http://localhost:3000/api/participant-files/exp-123?sessionId=local-1"
      ) {
        throw new Error("files unavailable");
      }
      if (url === "http://localhost:3000/api/download-session/local-1/exp-123") {
        return okJson({ success: true });
      }
      if (
        String(url).startsWith(
          "http://localhost:3000/api/session-results/local-1/exp-123",
        ) &&
        init?.method === "DELETE"
      ) {
        return okJson({ success: true });
      }
      if (url === "http://localhost:3000/api/session-results/exp-123") {
        return okJson({ sessions: sessionsFixture });
      }
      return okJson({ success: true });
    });

    fireEvent.click(screen.getByText("Files (1)"));

    expect(await screen.findByText("No files")).toBeInTheDocument();
    fireEvent.click(screen.getByText("▲ Close"));
    expect(screen.queryByText("No files")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("CSV"));
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/download-session/local-1/exp-123",
      );
    });

    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/session-results/local-1/exp-123",
        { method: "DELETE" },
      );
    });
  });

  it("selects local sessions for ZIP download and deletion", async () => {
    const saveZipFile = vi.fn(async () => ({ success: true }));
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: { saveZipFile },
    });
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ResultsList activeTab="local" />);

    expect(await screen.findByText("local-1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Select sessions"));

    const switches = screen.getAllByLabelText("toggle switch");
    fireEvent.click(switches[1]);
    fireEvent.click(screen.getByText("Download (1)"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/download-sessions-zip",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sessionIds: ["local-1"],
            experimentID: "exp-123",
          }),
        }),
      );
    });
    expect(saveZipFile).toHaveBeenCalledWith([1, 2, 3], "sessions.zip");

    fireEvent.click(screen.getByText("Delete (1)"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/session-results/local-1/exp-123",
        { method: "DELETE" },
      );
    });
  });

  it("selects online sessions and opens selected online downloads", async () => {
    render(<ResultsList activeTab="online" />);

    expect(await screen.findByText("online-session-1")).toBeInTheDocument();
    vi.useFakeTimers();

    fireEvent.click(screen.getByText("Select sessions"));
    fireEvent.click(screen.getAllByLabelText("toggle switch")[1]);
    fireEvent.click(screen.getByText("Download (1)"));

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://storage.test/session.csv",
    );

    vi.useRealTimers();
  });
});
