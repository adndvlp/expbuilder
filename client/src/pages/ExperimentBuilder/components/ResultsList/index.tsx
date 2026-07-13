import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useExperimentID } from "../../hooks/useExperimentID";
import ResultsTable from "./components/ResultsTable";
import ResultsToolbar from "./components/ResultsToolbar";
import SessionsActions from "./SessionsActions";
import {
  filterSessions,
  getEmptyMessage,
  getFilterOptions,
} from "./services/sessionFiltering";
import {
  EMPTY_FILTERS,
  Filters,
  ParticipantFile,
  SessionMeta,
  TabType,
} from "./types";

export type { ParticipantFile, SessionMeta, TabType } from "./types";

const API_URL = import.meta.env.VITE_API_URL;

type ResultsListProps = { activeTab: TabType };

export default function ResultsList({ activeTab }: ResultsListProps) {
  const [localActiveSessions, setLocalActiveSessions] = useState<SessionMeta[]>(
    [],
  );
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sessionFiles, setSessionFiles] = useState<
    Record<string, ParticipantFile[] | null | undefined>
  >({});
  const [expandedFileSession, setExpandedFileSession] = useState<string | null>(
    null,
  );
  const experimentID = useExperimentID();

  useEffect(() => {
    setFilters({ ...EMPTY_FILTERS });
  }, [activeTab]);

  useEffect(() => {
    if (!experimentID) return;
    const socket: Socket = io(API_URL);
    socket.on("connect", () => {
      console.log("WebSocket connected");
      socket.emit("listen-experiment", experimentID);
    });
    socket.on(
      "session-update",
      (data: { experimentID: string; sessions: SessionMeta[] }) => {
        if (data.experimentID === experimentID) {
          console.log("Session update received:", data.sessions);
          setLocalActiveSessions(data.sessions);
        }
      },
    );
    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });
    return () => {
      socket.disconnect();
    };
  }, [experimentID]);

  const actions = SessionsActions({
    experimentID,
    localActiveSessions,
    activeTab,
    selected,
    sessions,
    setSelected,
    setLoading,
    setOnlineLoading,
    setSessions,
    setSelectMode,
  });

  useEffect(() => {
    if (!experimentID || sessions.length === 0) return;
    if (activeTab !== "local" && activeTab !== "preview") return;
    fetch(`${API_URL}/api/participant-files/${experimentID}`)
      .then((response) => response.json())
      .then((allFiles: ParticipantFile[]) => {
        const grouped: Record<string, ParticipantFile[]> = {};
        for (const session of sessions) grouped[session.sessionId] = [];
        for (const file of allFiles) {
          if (file.sessionId && grouped[file.sessionId] !== undefined) {
            grouped[file.sessionId].push(file);
          }
        }
        setSessionFiles(grouped);
      })
      .catch(() => {});
  }, [sessions, experimentID, activeTab]);

  const toggleFilesPanel = async (sessionId: string) => {
    if (expandedFileSession === sessionId) {
      setExpandedFileSession(null);
      return;
    }
    setExpandedFileSession(sessionId);
    if (activeTab === "online") {
      setSessionFiles((current) => ({ ...current, [sessionId]: undefined }));
      const files = await actions.fetchOnlineSessionFiles(sessionId);
      setSessionFiles((current) => ({ ...current, [sessionId]: files }));
      return;
    }
    try {
      const response = await fetch(
        `${API_URL}/api/participant-files/${experimentID}?sessionId=${encodeURIComponent(sessionId)}`,
      );
      const files: ParticipantFile[] = await response.json();
      setSessionFiles((current) => ({ ...current, [sessionId]: files }));
    } catch {
      setSessionFiles((current) => ({ ...current, [sessionId]: [] }));
    }
  };

  const handleDeleteParticipantFile = async (
    sessionId: string,
    fileId: string,
  ) => {
    try {
      await fetch(
        `${API_URL}/api/participant-files/${experimentID}/${fileId}`,
        { method: "DELETE" },
      );
      setSessionFiles((current) => ({
        ...current,
        [sessionId]:
          current[sessionId]?.filter((file) => file.id !== fileId) ?? [],
      }));
    } catch {
      // Keep the current file list when a deletion request cannot complete.
    }
  };

  const filteredSessions = filterSessions(sessions, filters);
  const { browsers, operatingSystems, resolutions } =
    getFilterOptions(sessions);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const isLoading = activeTab === "online" ? onlineLoading : loading;

  return (
    <div
      className="results-container"
      style={{ marginTop: 25, flex: 1, minHeight: 0 }}
    >
      <ResultsToolbar
        activeTab={activeTab}
        sessionsCount={sessions.length}
        filteredCount={filteredSessions.length}
        selectMode={selectMode}
        setSelectMode={setSelectMode}
        selectedCount={selected.length}
        onlineLoading={onlineLoading}
        filters={filters}
        setFilters={setFilters}
        browsers={browsers}
        operatingSystems={operatingSystems}
        resolutions={resolutions}
        hasActiveFilters={hasActiveFilters}
        onRefresh={actions.handleRefresh}
        onCancelSelect={actions.handleCancelSelect}
        onDownloadSelected={actions.handleDownloadSelected}
        onDownloadSelectedOnline={actions.handleDownloadSelectedOnline}
        onDeleteSelected={actions.handleDeleteSelected}
      />
      {isLoading ? (
        <p className="results-text">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="results-text">{getEmptyMessage(activeTab)}</p>
      ) : (
        <ResultsTable
          sessions={sessions}
          filteredSessions={filteredSessions}
          activeTab={activeTab}
          selectMode={selectMode}
          selected={selected}
          hasActiveFilters={hasActiveFilters}
          sessionFiles={sessionFiles}
          expandedFileSession={expandedFileSession}
          onToggleSelect={actions.toggleSelect}
          onToggleSelectAll={actions.toggleSelectAll}
          onToggleFiles={toggleFilesPanel}
          onDeleteFile={handleDeleteParticipantFile}
          onDownloadCsv={actions.handleDownloadCSV}
          onDeleteSession={actions.handleDeleteSession}
        />
      )}
    </div>
  );
}
