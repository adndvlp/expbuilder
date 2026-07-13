import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ResultsList from "../../../pages/ExperimentBuilder/components/ResultsList";

type ResultsTableProps = {
  sessionFiles: Record<string, unknown[] | null | undefined>;
  onDeleteFile: (sessionId: string, fileId: string) => void;
};

type TestSession = {
  _id: string;
  sessionId: string;
  createdAt: string;
  state: string;
};

type SessionsActionsProps = {
  setSessions: Dispatch<SetStateAction<TestSession[]>>;
};

vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "exp-123",
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ResultsList/components/ResultsToolbar",
  () => ({ default: () => null }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ResultsList/components/ResultsTable",
  () => ({
    default: ({ sessionFiles, onDeleteFile }: ResultsTableProps) => (
      <div>
        <output data-testid="session-files">
          {JSON.stringify(sessionFiles)}
        </output>
        <button type="button" onClick={() => onDeleteFile("local-1", "file-1")}>
          Delete pending file
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ResultsList/SessionsActions",
  async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
      default: function MockSessionsActions({
        setSessions,
      }: SessionsActionsProps) {
        React.useEffect(() => {
          setSessions([
            {
              _id: "local-1",
              sessionId: "local-1",
              createdAt: "2026-05-24T10:00:00.000Z",
              state: "completed",
            },
          ]);
        }, [setSessions]);
        return {
          handleRefresh: vi.fn(),
          handleCancelSelect: vi.fn(),
          handleDownloadSelected: vi.fn(),
          handleDownloadSelectedOnline: vi.fn(),
          handleDeleteSelected: vi.fn(),
          toggleSelect: vi.fn(),
          toggleSelectAll: vi.fn(),
          handleDownloadCSV: vi.fn(),
          handleDeleteSession: vi.fn(),
          fetchOnlineSessionFiles: vi.fn(),
        };
      },
    };
  },
);

describe("ResultsList participant file deletion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an empty file list when deletion wins the preload race", async () => {
    const neverResolves = new Promise<Response>(() => {});
    const fetchMock = vi.fn((_: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? Promise.resolve({ ok: true } as Response)
        : neverResolves,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ResultsList activeTab="local" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete pending file" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/api/participant-files/exp-123/file-1",
        { method: "DELETE" },
      );
      expect(screen.getByTestId("session-files")).toHaveTextContent(
        '{"local-1":[]}',
      );
    });
  });
});
