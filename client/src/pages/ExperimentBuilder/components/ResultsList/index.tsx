import { useEffect, useState } from "react";
import Switch from "react-switch";
import { useExperimentID } from "../../hooks/useExperimentID";
import { io, Socket } from "socket.io-client";
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
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);

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
    toggleSelect,
    toggleSelectAll,
    handleCancelSelect,
  } = SessionsActions({
    experimentID,
    localActiveSessions,
    activeTab,
    selected,
    sessions,
    setSelected,
    setLoading,
    setSessions,
    setSelectMode,
  });

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
      <h4 className="results-title">{getTitle()}</h4>
      {loading ? (
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
              <button
                className="remove-button"
                style={{ fontSize: "12px" }}
                disabled={selected.length === 0}
                onClick={handleDeleteSelected}
              >
                Delete selected ({selected.length})
              </button>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
