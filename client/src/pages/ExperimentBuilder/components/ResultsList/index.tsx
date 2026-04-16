import { useEffect, useRef, useState } from "react";
import Switch from "react-switch";
import { useExperimentID } from "../../hooks/useExperimentID";
import { io, Socket } from "socket.io-client";
import { openExternal } from "../../../../lib/openExternal";
import SessionsActions from "./SessionsActions";
import { FaFilter } from "react-icons/fa";
import { MdClose } from "react-icons/md";
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

  type Filters = {
    state: string;
    browser: string;
    os: string;
    resolution: string;
    datePeriod: string;
  };
  const [filters, setFilters] = useState<Filters>({
    state: "",
    browser: "",
    os: "",
    resolution: "",
    datePeriod: "",
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        filterBtnRef.current?.contains(e.target as Node)
      )
        return;
      setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  // Participant files: map of sessionId → file list (null = not yet fetched)
  const [sessionFiles, setSessionFiles] = useState<
    Record<string, ParticipantFile[] | null>
  >({});
  const [expandedFileSession, setExpandedFileSession] = useState<string | null>(
    null,
  );

  // Reset filters when switching tabs
  useEffect(() => {
    setFilters({
      state: "",
      browser: "",
      os: "",
      resolution: "",
      datePeriod: "",
    });
  }, [activeTab]);

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
      setSessionFiles((prev) => ({
        ...prev,
        [sessionId]: undefined as unknown as ParticipantFile[],
      }));
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

  // Derived unique filter options from sessions
  const uniqueBrowsers = [
    ...new Set(
      sessions.map((s) => s.metadata?.browser).filter((b): b is string => !!b),
    ),
  ];
  const uniqueOS = [
    ...new Set(
      sessions.map((s) => s.metadata?.os).filter((o): o is string => !!o),
    ),
  ];
  const uniqueResolutions = [
    ...new Set(
      sessions
        .map((s) => s.metadata?.screenResolution)
        .filter((r): r is string => !!r),
    ),
  ];

  // Apply column filters
  const filteredSessions = sessions.filter((s) => {
    if (filters.state && s.state !== filters.state) return false;
    if (filters.browser && s.metadata?.browser !== filters.browser)
      return false;
    if (filters.os && s.metadata?.os !== filters.os) return false;
    if (
      filters.resolution &&
      s.metadata?.screenResolution !== filters.resolution
    )
      return false;
    if (filters.datePeriod) {
      const now = new Date();
      const created = new Date(s.createdAt).getTime();
      const startOf = (d: Date) => {
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      };
      if (filters.datePeriod === "today" && created < startOf(new Date(now)))
        return false;
      if (filters.datePeriod === "yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        if (created < startOf(y) || created >= startOf(new Date(now)))
          return false;
      }
      if (filters.datePeriod === "7d" && created < now.getTime() - 7 * 86400000)
        return false;
      if (
        filters.datePeriod === "30d" &&
        created < now.getTime() - 30 * 86400000
      )
        return false;
      if (
        filters.datePeriod === "90d" &&
        created < now.getTime() - 90 * 86400000
      )
        return false;
    }
    return true;
  });

  const hasActiveFilters =
    filters.state ||
    filters.browser ||
    filters.os ||
    filters.resolution ||
    filters.datePeriod;

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
    <div
      className="results-container"
      style={{ marginTop: 25, flex: 1, minHeight: 0 }}
    >
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
        {(activeTab === "local" || activeTab === "online") &&
          sessions.length > 0 &&
          !selectMode && (
            <button
              className="select-mode-btn"
              style={{
                borderRadius: "6px",
                fontSize: "12px",
                background:
                  "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              }}
              onClick={() => setSelectMode(true)}
            >
              Select sessions
            </button>
          )}
        {selectMode && (
          <>
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
              Cancel
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
                Download ({selected.length})
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
                Download ({selected.length})
              </button>
            )}
            {activeTab !== "online" && (
              <button
                className="remove-button"
                style={{ fontSize: "12px" }}
                disabled={selected.length === 0}
                onClick={handleDeleteSelected}
              >
                Delete ({selected.length})
              </button>
            )}
          </>
        )}
        {(activeTab === "local" || activeTab === "online") &&
          sessions.length > 0 && (
            <div style={{ position: "relative" }} ref={filterBtnRef}>
              <button
                className="download-csv-btn"
                style={{
                  borderRadius: "6px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: hasActiveFilters
                    ? "linear-gradient(135deg, var(--dark-gold), var(--gold))"
                    : "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                }}
                onClick={() => {
                  if (!filterOpen && filterBtnRef.current) {
                    const rect = filterBtnRef.current.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom + 6, left: rect.left });
                  }
                  setFilterOpen((o) => !o);
                }}
              >
                <FaFilter size={11} />
                Filter
                {hasActiveFilters && (
                  <span
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: "50%",
                      width: 16,
                      height: 16,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {
                      [filters.state, filters.browser, filters.os].filter(
                        Boolean,
                      ).length
                    }
                  </span>
                )}
              </button>
              {filterOpen && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: "fixed",
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    zIndex: 9999,
                    background: "var(--neutral-dark, #1a1a2e)",
                    border: "1px solid var(--neutral-mid, #444)",
                    borderRadius: 8,
                    padding: "14px 16px 10px",
                    minWidth: 220,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-dark, #f8f8f8)",
                      }}
                    >
                      Filter sessions
                    </span>
                    <button
                      onClick={() => setFilterOpen(false)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-dark, #aaa)",
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      <MdClose size={15} />
                    </button>
                  </div>
                  {/* scrollable filters */}
                  <div
                    style={{
                      overflowY: "auto",
                      maxHeight: 300,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      paddingBottom: 4,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        fontSize: 11,
                        color: "var(--text-dark, #aaa)",
                      }}
                    >
                      State
                      <select
                        value={filters.state}
                        onChange={(e) =>
                          setFilters((f) => ({ ...f, state: e.target.value }))
                        }
                        style={{
                          padding: "5px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--neutral-mid, #444)",
                          background: "var(--surface, #23272e)",
                          color: "var(--text-dark, #f8f8f8)",
                          fontSize: 12,
                        }}
                      >
                        <option value="">All</option>
                        <option value="initiated">Initiated</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="abandoned">Abandoned</option>
                      </select>
                    </label>
                    {uniqueBrowsers.length > 0 && (
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          fontSize: 11,
                          color: "var(--text-dark, #aaa)",
                        }}
                      >
                        Browser
                        <select
                          value={filters.browser}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              browser: e.target.value,
                            }))
                          }
                          style={{
                            padding: "5px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--neutral-mid, #444)",
                            background: "var(--surface, #23272e)",
                            color: "var(--text-dark, #f8f8f8)",
                            fontSize: 12,
                          }}
                        >
                          <option value="">All</option>
                          {uniqueBrowsers.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {uniqueOS.length > 0 && (
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          fontSize: 11,
                          color: "var(--text-dark, #aaa)",
                        }}
                      >
                        OS
                        <select
                          value={filters.os}
                          onChange={(e) =>
                            setFilters((f) => ({ ...f, os: e.target.value }))
                          }
                          style={{
                            padding: "5px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--neutral-mid, #444)",
                            background: "var(--surface, #23272e)",
                            color: "var(--text-dark, #f8f8f8)",
                            fontSize: 12,
                          }}
                        >
                          <option value="">All</option>
                          {uniqueOS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {uniqueResolutions.length > 0 && (
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          fontSize: 11,
                          color: "var(--text-dark, #aaa)",
                        }}
                      >
                        Resolution
                        <select
                          value={filters.resolution}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              resolution: e.target.value,
                            }))
                          }
                          style={{
                            padding: "5px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--neutral-mid, #444)",
                            background: "var(--surface, #23272e)",
                            color: "var(--text-dark, #f8f8f8)",
                            fontSize: 12,
                          }}
                        >
                          <option value="">All</option>
                          {uniqueResolutions.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        fontSize: 11,
                        color: "var(--text-dark, #aaa)",
                      }}
                    >
                      Date
                      <select
                        value={filters.datePeriod}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            datePeriod: e.target.value,
                          }))
                        }
                        style={{
                          padding: "5px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--neutral-mid, #444)",
                          background: "var(--surface, #23272e)",
                          color: "var(--text-dark, #f8f8f8)",
                          fontSize: 12,
                        }}
                      >
                        <option value="">All time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                      </select>
                    </label>
                  </div>
                  {/* end scrollable filters */}
                  {hasActiveFilters && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: 4,
                        borderTop: "1px solid var(--neutral-mid, #444)",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#aaa" }}>
                        {filteredSessions.length} of {sessions.length}
                      </span>
                      <button
                        onClick={() =>
                          setFilters({
                            state: "",
                            browser: "",
                            os: "",
                            resolution: "",
                            datePeriod: "",
                          })
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--danger, #ef4444)",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </div>
      {(activeTab === "online" ? onlineLoading : loading) ? (
        <p className="results-text">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="results-text">{getEmptyMessage()}</p>
      ) : (
        <div className="results-table-container">
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
                {activeTab !== "online" && <th>Actions</th>}
                {activeTab === "online" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 && hasActiveFilters ? (
                <tr>
                  <td
                    colSpan={99}
                    style={{
                      textAlign: "center",
                      padding: 20,
                      color: "var(--text-dark, #aaa)",
                    }}
                  >
                    No sessions match the current filters.
                  </td>
                </tr>
              ) : null}
              {filteredSessions.map((s) => (
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
