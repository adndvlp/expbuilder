import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResultsList from "../../../pages/ExperimentBuilder/components/ResultsList";

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

vi.mock("../../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
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
        url === "http://localhost:3000/api/participant-files/exp-123/file-1" &&
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
});
