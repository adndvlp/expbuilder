import { useEffect, useState } from "react";
import ExperimentPreview from "./ExperimentPreview";
import { useExperimentID } from "../hooks/useExperimentID";
const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;

type SessionMeta = {
  _id: string;
  sessionId: string;
  createdAt: string;
};

export default function ResultsList() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);

  const experimentID = useExperimentID();

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(DATA_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list",
          experimentID: experimentID,
        }),
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setSessions([]);
    }
    setLoading(false);
    setSelected([]);
    setSelectMode(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [ExperimentPreview]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to delete this session result?"))
      return;
    try {
      await fetch(DATA_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          experimentID: experimentID,
          sessionId: sessionId,
        }),
      });
      fetchSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  // Borrar múltiples sesiones
  const handleDeleteSelected = async () => {
    if (
      selected.length === 0 ||
      !window.confirm(`Delete ${selected.length} selected session(s)?`)
    )
      return;
    try {
      await Promise.all(
        selected.map((sessionId) =>
          fetch(DATA_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete",
              experimentID: experimentID,
              sessionId: sessionId,
            }),
          })
        )
      );
      fetchSessions();
    } catch (error) {
      console.error("Error deleting sessions:", error);
    }
  };

  // Manejar selección individual y global
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

  const handleDownloadCSV = async (sessionId: string) => {
    try {
      const res = await fetch(DATA_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "download",
          experimentID: experimentID,
          sessionId: sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      // The API returns CSV as text, not JSON
      const csvText = await res.text();

      // Crear un blob con el CSV
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      // Crear un elemento <a> temporal para descargar
      const link = document.createElement("a");
      link.href = url;
      link.download = `${experimentID}_${sessionId}.csv`;
      document.body.appendChild(link);
      link.click();

      // Limpiar
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading session:", error);
      alert("Failed to download session data");
    }
  };

  return (
    <div className="results-container" style={{ marginTop: 25 }}>
      <h4 className="results-title">Session results</h4>
      {loading ? (
        <p className="results-text">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="results-text">There are no session results.</p>
      ) : (
        <div className="results-table-container">
          <table className="results-table">
            <thead>
              <tr>
                {/* Select column only in selectMode */}
                {selectMode && (
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={
                        selected.length === sessions.length &&
                        sessions.length > 0
                      }
                      onChange={toggleSelectAll}
                      style={{
                        width: 22,
                        height: 22,
                        accentColor: "#FFD600",
                        cursor: "pointer",
                        filter:
                          selected.length === sessions.length &&
                          sessions.length > 0
                            ? "invert(1) brightness(2) saturate(2)"
                            : undefined,
                      }}
                    />
                  </th>
                )}
                <th>Session ID</th>
                <th>Date</th>
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
                      style={{ marginLeft: 0 }}
                      onClick={() => setSelectMode(true)}
                    >
                      Select sessions
                    </button>
                  )}
                  {selectMode && (
                    <div
                      key="select-mode-buttons"
                      style={{ display: "contents" }}
                    >
                      <button
                        className="cancel-select-btn"
                        style={{ marginLeft: 0 }}
                        onClick={handleCancelSelect}
                      >
                        Cancel
                      </button>
                      <button
                        className="remove-button"
                        style={{ marginLeft: 0, fontSize: "11px" }}
                        disabled={selected.length === 0}
                        onClick={handleDeleteSelected}
                      >
                        Delete({selected.length})
                      </button>
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id}>
                  {selectMode && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(s.sessionId)}
                        onChange={() => toggleSelect(s.sessionId)}
                        style={{
                          width: 22,
                          height: 22,
                          accentColor: "#FFD600",
                          cursor: "pointer",
                          filter: selected.includes(s.sessionId)
                            ? "invert(1) brightness(2) saturate(2)"
                            : undefined,
                        }}
                      />
                    </td>
                  )}
                  <td>{s.sessionId}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
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
