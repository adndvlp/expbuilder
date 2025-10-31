import { useEffect, useState } from "react";
import ExperimentPreview from "./ExperimentPreview";
import { useExperimentID } from "../hooks/useExperimentID";
// No usar Firebase, usar endpoints REST locales
const API_URL = import.meta.env.VITE_API_URL;

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

  // Use local endpoint to get sessions
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/session-results/${experimentID}`);
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
      // @ts-ignore
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

  return (
    <div className="results-container" style={{ marginTop: 25 }}>
      <h4 className="results-title">Session Results</h4>
      {loading ? (
        <p className="results-text">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="results-text">There are no session results.</p>
      ) : (
        <div className="results-table-container">
          {selectMode && (
            <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              <button
                className="cancel-select-btn"
                style={{ fontSize: "12px" }}
                onClick={handleCancelSelect}
              >
                Cancel selection
              </button>
              <button
                className="download-csv-btn"
                style={{ fontSize: "12px" }}
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
                      style={{ marginLeft: 0, borderRadius: "6px" }}
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
