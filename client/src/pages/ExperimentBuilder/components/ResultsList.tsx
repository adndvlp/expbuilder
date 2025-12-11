import { useEffect, useState } from "react";
import Switch from "react-switch";
import { useExperimentID } from "../hooks/useExperimentID";
import { getDatabase, ref, onValue } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
import { io, Socket } from "socket.io-client";
// No usar Firebase, usar endpoints REST locales
const API_URL = import.meta.env.VITE_API_URL;

type SessionMeta = {
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

type TabType = "preview" | "local" | "online";

interface ResultsListProps {
  activeTab: TabType;
}

export default function ResultsList({ activeTab }: ResultsListProps) {
  const [allSessions, setAllSessions] = useState<SessionMeta[]>([]);
  const [onlineSessions, setOnlineSessions] = useState<SessionMeta[]>([]);
  const [localActiveSessions, setLocalActiveSessions] = useState<SessionMeta[]>(
    []
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
      }
    );

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, [experimentID]);

  // Fetch online sessions from Firebase Realtime Database
  const fetchOnlineSessions = async () => {
    try {
      // Inicializar Firebase si no está inicializado
      let app;
      if (getApps().length === 0) {
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          databaseURL:
            import.meta.env.VITE_FIREBASE_DATABASE_URL ||
            `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }

      const database = getDatabase(app);
      const sessionsRef = ref(database, `sessions/${experimentID}`);

      // Escuchar cambios en tiempo real
      onValue(
        sessionsRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const sessionsList: SessionMeta[] = Object.entries(data).map(
              ([sessionId, sessionData]) => {
                const sd = sessionData as Record<string, unknown>;
                return {
                  _id: sessionId,
                  sessionId: sessionId,
                  createdAt:
                    (sd.startedAt as string) ||
                    (sd.createdAt as string) ||
                    new Date().toISOString(),
                  state:
                    (sd.state as "initiated" | "in-progress" | "completed") ||
                    "initiated",
                };
              }
            );
            setOnlineSessions(sessionsList);
          } else {
            setOnlineSessions([]);
          }
        },
        (error) => {
          console.error("Error fetching online sessions:", error);
          setOnlineSessions([]);
        }
      );
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setOnlineSessions([]);
    }
  };

  // Use local endpoint to get sessions
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/session-results/${experimentID}`);
      const data = await res.json();
      setAllSessions(data.sessions || []);

      // Fetch online sessions from Firebase
      await fetchOnlineSessions();
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setAllSessions([]);
    }
    setLoading(false);
    setSelected([]);
    setSelectMode(false);
  };

  // Filter sessions based on active tab
  useEffect(() => {
    if (activeTab === "preview") {
      // Preview results: sessionId contains "_result_"
      setSessions(allSessions.filter((s) => s.sessionId.includes("_result_")));
    } else if (activeTab === "local") {
      // Local experiments: combinar sesiones de DB con sesiones activas de WebSocket
      const dbLocalSessions = allSessions.filter(
        (s) =>
          !s.sessionId.includes("_result_") &&
          !s.sessionId.includes("online_") &&
          !s.isOnline
      );

      // Merge con sesiones activas del WebSocket (prioridad a estado en tiempo real)
      const sessionMap = new Map<string, SessionMeta>();

      // Primero agregar las de DB
      dbLocalSessions.forEach((s) => sessionMap.set(s.sessionId, s));

      // Luego actualizar/agregar las activas del WebSocket
      localActiveSessions.forEach((s) => {
        const existing = sessionMap.get(s.sessionId);
        if (existing) {
          // Actualizar estado con el del WebSocket (más reciente)
          sessionMap.set(s.sessionId, {
            ...existing,
            state: s.state,
            metadata: { ...existing.metadata, ...s.metadata },
          });
        } else {
          // Agregar nueva sesión activa
          sessionMap.set(s.sessionId, s);
        }
      });

      setSessions(Array.from(sessionMap.values()));
    } else if (activeTab === "online") {
      // Online experiments: combinar sesiones de Firebase RT con metadata de db.json
      const onlineSessionsMap = new Map<string, SessionMeta>();

      // Primero agregar sesiones de Firebase Realtime DB (activas)
      onlineSessions.forEach((s) => onlineSessionsMap.set(s.sessionId, s));

      // Luego agregar/actualizar con metadata de db.json (persistidas)
      const dbOnlineSessions = allSessions.filter((s) => s.isOnline === true);
      dbOnlineSessions.forEach((s) => {
        const existing = onlineSessionsMap.get(s.sessionId);
        if (existing) {
          // Actualizar con metadata de db.json
          onlineSessionsMap.set(s.sessionId, {
            ...s,
            ...existing,
            metadata: { ...s.metadata, ...existing.metadata },
          });
        } else {
          // Sesión ya finalizada (solo en db.json, no en Firebase)
          onlineSessionsMap.set(s.sessionId, s);
        }
      });

      setSessions(Array.from(onlineSessionsMap.values()));
    }
  }, [activeTab, allSessions, onlineSessions, localActiveSessions]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentID]);

  // Use local endpoint to delete a session
  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to delete this session result?"))
      return;
    try {
      await fetch(
        `${API_URL}/api/session-results/${sessionId}/${experimentID}`,
        {
          method: "DELETE",
        }
      );
      fetchSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  // Delete multiple sessions using local endpoint
  const handleDeleteSelected = async () => {
    if (
      selected.length === 0 ||
      !window.confirm(`Delete ${selected.length} selected session(s)?`)
    )
      return;
    try {
      for (const sessionId of selected) {
        await fetch(
          `${API_URL}/api/session-results/${sessionId}/${experimentID}`,
          {
            method: "DELETE",
          }
        );
      }
      fetchSessions();
    } catch (error) {
      console.error("Error deleting sessions:", error);
    }
  };

  // Download multiple sessions as CSV and save them in a ZIP in the folder chosen by the user (Electron)
  const handleDownloadSelected = async () => {
    if (selected.length === 0) return;
    try {
      // Download all CSVs
      const files = [];
      for (const sessionId of selected) {
        const res = await fetch(
          `${API_URL}/api/download-session/${sessionId}/${experimentID}`
        );
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const csvText = await res.text();
        files.push({
          name: `${experimentID}_${sessionId}.csv`,
          content: csvText,
        });
      }
      // Call Electron to save the ZIP
      // @ts-expect-error - Electron API not typed
      const result = await window.electron.saveCsvZip(files, "sessions.zip");
      if (result.success) {
        alert("ZIP saved successfully.");
      } else {
        alert("Failed to save ZIP: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error downloading sessions:", error);
      alert("Failed to download selected sessions");
    }
  };

  // Handle individual and global selection
  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleSelectAll = () => {
    if (selected.length === sessions.length) setSelected([]);
    else setSelected(sessions.map((s) => s.sessionId));
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };

  // Download CSV using local endpoint
  const handleDownloadCSV = async (sessionId: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/download-session/${sessionId}/${experimentID}`
      );
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${experimentID}_${sessionId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading session:", error);
      alert("Failed to download session data");
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
