import { useEffect, useState } from "react";
import Switch from "react-switch";
import { useExperimentID } from "../../hooks/useExperimentID";
import { io, Socket } from "socket.io-client";
import { openExternal } from "../../../../lib/openExternal";
import SessionsActions from "./SessionsActions";
// No usar Firebase, usar endpoints REST locales
const API_URL = import.meta.env.VITE_API_URL;

export type SessionMeta = {
  _id: string;
  sessionId: string;
  createdAt: string;
  state?: "initiated" | "in-progress" | "completed" | "abandoned";
  metadata?: {
    browser?: string;
    browserVersion?: string;
    os?: string;
    screenResolution?: string;
    language?: string;
    startedAt?: string;
  };
  isOnline?: boolean;
  fileUrl?: string;
};

export type ParticipantFile = {
  id: string;
  sessionId: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
};

export type TabType = "preview" | "local" | "online";

type ResultsListProps = {
  activeTab: TabType;
};

export default function ResultsList({ activeTab }: ResultsListProps) {
  const [localActiveSessions, setLocalActiveSessions] = useState<SessionMeta[]>(
    [],
  );
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);

  // Participant files: map of sessionId → file list (null = not yet fetched)
  const [sessionFiles, setSessionFiles] = useState<
    Record<string, ParticipantFile[] | null>
  >({});
  const [expandedFileSession, setExpandedFileSession] = useState<string | null>(
    null,
  );

  const experimentID = useExperimentID();

  // Conectar a WebSocket para sesiones locales en tiempo real
  useEffect(() => {
    if (!experimentID) return;

    const socket: Socket = io(API_URL);

    socket.on("connect", () => {
      console.log("WebSocket connected");
      // Escuchar actualizaciones de este experimento
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

  const {
    handleDeleteSession,
    handleDownloadCSV,
    handleDeleteSelected,
    handleDownloadSelected,
    handleDownloadSelectedOnline,
    toggleSelect,
    toggleSelectAll,
    handleCancelSelect,
    handleRefresh,
    fetchOnlineSessionFiles,
  } = SessionsActions({
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

  // Pre-load all file records for the experiment whenever sessions change.
  useEffect(() => {
    if (!experimentID || sessions.length === 0) return;
    if (activeTab !== "local" && activeTab !== "preview") return;
    fetch(`${API_URL}/api/participant-files/${experimentID}`)
      .then((r) => r.json())
      .then((all: ParticipantFile[]) => {
        const grouped: Record<string, ParticipantFile[]> = {};
        for (const s of sessions) grouped[s.sessionId] = [];
        for (const f of all) {
          if (f.sessionId && grouped[f.sessionId] !== undefined) {
            grouped[f.sessionId].push(f);
          }
        }
        setSessionFiles(grouped);
      })
      .catch(() => {});
  }, [sessions, experimentID, activeTab]);

  // Fetch participant-uploaded files for a session on first expand.
  const toggleFilesPanel = async (sessionId: string) => {
    if (expandedFileSession === sessionId) {
      setExpandedFileSession(null);
      return;
    }
    setExpandedFileSession(sessionId);
    if (activeTab === "online") {
      setSessionFiles((prev) => ({ ...prev, [sessionId]: undefined as unknown as ParticipantFile[] }));
      const files = await fetchOnlineSessionFiles(sessionId);
      setSessionFiles((prev) => ({ ...prev, [sessionId]: files }));
    } else {
      // Re-fetch this session's files to get latest on expand
      try {
        const res = await fetch(
          `${API_URL}/api/participant-files/${experimentID}?sessionId=${encodeURIComponent(sessionId)}`,
        );
        const data: ParticipantFile[] = await res.json();
        setSessionFiles((prev) => ({ ...prev, [sessionId]: data }));
      } catch {
        setSessionFiles((prev) => ({ ...prev, [sessionId]: [] }));
      }
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
      setSessionFiles((prev) => ({
        ...prev,
        [sessionId]: (prev[sessionId] ?? []).filter((f) => f.id !== fileId),
      }));
    } catch {
      // ignore
    }
  };

  const getTitle = () => {
    if (activeTab === "preview") return "Preview Results";
    if (activeTab === "local") return "Local Experiment Sessions";
    return "Online Experiment Sessions";
  };

  const getEmptyMessage = () => {
    if (activeTab === "preview") return "There are no preview results.";
    if (activeTab === "local") return "There are no local experiment sessions.";
    return "There are no online experiment sessions.";
  };

  const getStateBadge = (state?: string) => {
    if (!state) return null;

    let backgroundColor = "#6b7280";
    let text = "Unknown";

    if (state === "initiated") {
      backgroundColor = "#f59e0b";
      text = "Initiated";
    } else if (state === "in-progress") {
      backgroundColor = "#3b82f6";
      text = "In Progress";
    } else if (state === "completed") {
      backgroundColor = "#10b981";
      text = "Completed";
    } else if (state === "abandoned") {
      backgroundColor = "#ef4444";
      text = "Abandoned";
    }

    return (
      <span
        style={{
          padding: "4px 12px",
          borderRadius: "12px",
          backgroundColor,
          color: "white",
          fontSize: "12px",
          fontWeight: "600",
          display: "inline-block",
        }}
      >
        {text}
      </span>
    );
  };

  return (
    <div className="results-container" style={{ marginTop: 25 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 4,
        }}
      >
        <h4 className="results-title" style={{ margin: 0 }}>
          {getTitle()}
        </h4>
        {activeTab === "online" && (
          <button
            className="download-csv-btn"
            style={{
              borderRadius: "6px",
              fontSize: "12px",
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
            }}
            onClick={handleRefresh}
            disabled={onlineLoading}
          >
            {onlineLoading ? "Loading..." : "↻ Refresh"}
          </button>
        )}
      </div>
      {(activeTab === "online" ? onlineLoading : loading) ? (
        <p className="results-text">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="results-text">{getEmptyMessage()}</p>
      ) : (
        <div className="results-table-container">
          {selectMode && (
            <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              <button
                className="cancel-select-btn"
                style={{
                  borderRadius: "6px",
                  fontSize: "12px",
                  background:
                    "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                }}
                onClick={handleCancelSelect}
              >
                Cancel selection
              </button>
              {activeTab !== "online" && (
                <button
                  className="download-csv-btn"
                  style={{
                    borderRadius: "6px",
                    fontSize: "12px",
                    background:
                      "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                  }}
                  disabled={selected.length === 0}
                  onClick={handleDownloadSelected}
                >
                  Download selected
                </button>
              )}
              {activeTab === "online" && (
                <button
                  className="download-csv-btn"
                  style={{
                    borderRadius: "6px",
                    fontSize: "12px",
                    background:
                      "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                  }}
                  disabled={selected.length === 0}
                  onClick={handleDownloadSelectedOnline}
                >
                  Download selected
                </button>
              )}
              {activeTab !== "online" && (
                <button
                  className="remove-button"
                  style={{ fontSize: "12px" }}
                  disabled={selected.length === 0}
                  onClick={handleDeleteSelected}
                >
                  Delete selected ({selected.length})
                </button>
              )}
            </div>
          )}
          <table className="results-table">
            <thead>
              <tr>
                {/* Select column only in selectMode */}
                {selectMode && (
                  <th style={{ width: 40 }}>
                    <Switch
                      checked={
                        selected.length === sessions.length &&
                        sessions.length > 0
                      }
                      onChange={toggleSelectAll}
                      onColor="#FFD600"
                      onHandleColor="#ffffff"
                      handleDiameter={20}
                      uncheckedIcon={false}
                      checkedIcon={false}
                      height={18}
                      width={38}
                    />
                  </th>
                )}
                <th>Session ID</th>
                <th>Date</th>
                {(activeTab === "local" || activeTab === "online") && (
                  <th>State</th>
                )}
                {(activeTab === "local" || activeTab === "online") && (
                  <>
                    <th>Browser</th>
                    <th>OS</th>
                    <th>Resolution</th>
                  </>
                )}
                {(activeTab === "local" || activeTab === "preview") && (
                  <th>Files</th>
                )}
                {activeTab === "online" && <th>Files</th>}
                {activeTab === "online" && <th>File</th>}
                {activeTab !== "online" && (
                  <th
                    style={{
                      minWidth: 220,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span>Actions</span>
                    {!selectMode && (
                      <button
                        key="select-btn"
                        className="select-mode-btn"
                        style={{
                          marginLeft: 0,
                          borderRadius: "6px",
                          background:
                            "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                        }}
                        onClick={() => setSelectMode(true)}
                      >
                        Select sessions
                      </button>
                    )}
                  </th>
                )}
                {activeTab === "online" && !selectMode && (
                  <th style={{ minWidth: 120 }}>
                    <button
                      className="select-mode-btn"
                      style={{
                        borderRadius: "6px",
                        background:
                          "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                      }}
                      onClick={() => setSelectMode(true)}
                    >
                      Select sessions
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id}>
                  {selectMode && (
                    <td>
                      <Switch
                        checked={selected.includes(s.sessionId)}
                        onChange={() => toggleSelect(s.sessionId)}
                        onColor="#FFD600"
                        onHandleColor="#ffffff"
                        handleDiameter={20}
                        uncheckedIcon={false}
                        checkedIcon={false}
                        height={18}
                        width={38}
                      />
                    </td>
                  )}
                  <td>{s.sessionId}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  {(activeTab === "local" || activeTab === "online") && (
                    <td>{getStateBadge(s.state)}</td>
                  )}
                  {(activeTab === "local" || activeTab === "online") && (
                    <>
                      <td>
                        {s.metadata?.browser
                          ? `${s.metadata.browser}${s.metadata.browserVersion ? " " + s.metadata.browserVersion : ""}`
                          : "-"}
                      </td>
                      <td>{s.metadata?.os || "-"}</td>
                      <td>{s.metadata?.screenResolution || "-"}</td>
                    </>
                  )}
                  {(activeTab === "local" || activeTab === "preview") && (
                    <td style={{ verticalAlign: "top" }}>
                      <button
                        className="download-csv-btn"
                        style={{ fontSize: "11px" }}
                        onClick={() => toggleFilesPanel(s.sessionId)}
                      >
                        {expandedFileSession === s.sessionId
                          ? "▲ Close"
                          : `Files${sessionFiles[s.sessionId] ? ` (${sessionFiles[s.sessionId]!.length})` : ""}`}
                      </button>
                      {expandedFileSession === s.sessionId && (
                        <div
                          style={{
                            marginTop: 6,
                            minWidth: 220,
                            padding: "6px 8px",
                            background: "var(--surface, #1e1e1e)",
                            border: "1px solid var(--border, #333)",
                            borderRadius: 6,
                            fontSize: 11,
                          }}
                        >
                          {sessionFiles[s.sessionId] === undefined ? (
                            <span style={{ color: "#aaa" }}>Loading…</span>
                          ) : sessionFiles[s.sessionId]!.length === 0 ? (
                            <span style={{ color: "#aaa" }}>No files</span>
                          ) : (
                            <ul
                              style={{
                                margin: 0,
                                padding: 0,
                                listStyle: "none",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {sessionFiles[s.sessionId]!.map((f) => (
                                <li
                                  key={f.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <a
                                    href={`${API_URL}${f.url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={f.originalName}
                                    style={{
                                      flex: 1,
                                      color: "var(--gold, #FFD600)",
                                      textDecoration: "none",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      maxWidth: 180,
                                    }}
                                    title={f.originalName}
                                  >
                                    {f.originalName}
                                  </a>
                                  <span
                                    style={{ color: "#888", flexShrink: 0 }}
                                  >
                                    {f.sizeBytes < 1024 * 1024
                                      ? `${Math.round(f.sizeBytes / 1024)} KB`
                                      : `${(f.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
                                  </span>
                                  <button
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#ef4444",
                                      cursor: "pointer",
                                      padding: "0 2px",
                                      fontSize: 12,
                                      flexShrink: 0,
                                    }}
                                    title="Delete file"
                                    onClick={() =>
                                      handleDeleteParticipantFile(
                                        s.sessionId,
                                        f.id,
                                      )
                                    }
                                  >
                                    ✕
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  {activeTab === "online" && (
                    <td style={{ verticalAlign: "top" }}>
                      <button
                        className="download-csv-btn"
                        style={{ fontSize: "11px" }}
                        onClick={() => toggleFilesPanel(s.sessionId)}
                      >
                        {expandedFileSession === s.sessionId
                          ? "▲ Close"
                          : `Files${sessionFiles[s.sessionId] ? ` (${sessionFiles[s.sessionId]!.length})` : ""}`}
                      </button>
                      {expandedFileSession === s.sessionId && (
                        <div
                          style={{
                            marginTop: 6,
                            minWidth: 220,
                            padding: "6px 8px",
                            background: "var(--surface, #1e1e1e)",
                            border: "1px solid var(--border, #333)",
                            borderRadius: 6,
                            fontSize: 11,
                          }}
                        >
                          {sessionFiles[s.sessionId] === undefined ? (
                            <span style={{ color: "#aaa" }}>Loading…</span>
                          ) : sessionFiles[s.sessionId]!.length === 0 ? (
                            <span style={{ color: "#aaa" }}>No files</span>
                          ) : (
                            <ul
                              style={{
                                margin: 0,
                                padding: 0,
                                listStyle: "none",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {sessionFiles[s.sessionId]!.map((f) => (
                                <li
                                  key={f.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      flex: 1,
                                      color: "var(--gold, #FFD600)",
                                      textDecoration: "none",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      maxWidth: 180,
                                    }}
                                    title={f.originalName}
                                  >
                                    {f.originalName}
                                  </a>
                                  <span
                                    style={{ color: "#888", flexShrink: 0 }}
                                  >
                                    {f.sizeBytes < 1024 * 1024
                                      ? `${Math.round(f.sizeBytes / 1024)} KB`
                                      : `${(f.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  {activeTab === "online" && (
                    <td>
                      {s.fileUrl ? (
                        <button
                          className="download-csv-btn"
                          onClick={() => openExternal(s.fileUrl!)}
                          style={{ fontSize: "12px" }}
                        >
                          Download
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
                  {activeTab !== "online" && (
                    <td>
                      <button
                        className="download-csv-btn"
                        onClick={() => handleDownloadCSV(s.sessionId)}
                      >
                        CSV
                      </button>
                      {!selectMode && (
                        <button
                          className="remove-button"
                          onClick={() => handleDeleteSession(s.sessionId)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
