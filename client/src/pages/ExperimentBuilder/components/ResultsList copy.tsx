import { useEffect, useState } from "react";
import ExperimentPreview from "./ExperimentPreview";
import { useExperimentID } from "../hooks/useExperimentID";
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

  const fetchSessions = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/session-results/${experimentID}`);
    const data = await res.json();
    setSessions(data.sessions || []);
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
    await fetch(`${API_URL}/api/session-results/${sessionId}/${experimentID}`, {
      method: "DELETE",
    });
    fetchSessions();
  };

  // Borrar múltiples sesiones
  const handleDeleteSelected = async () => {
    if (
      selected.length === 0 ||
      !window.confirm(`Delete ${selected.length} selected session(s)?`)
    )
      return;
    await Promise.all(
      selected.map((id) =>
        fetch(`${API_URL}/api/session-results/${id}/${experimentID}`, {
          method: "DELETE",
        })
      )
    );
    fetchSessions();
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
                      className="select-mode-btn"
                      style={{ marginLeft: 0 }}
                      onClick={() => setSelectMode(true)}
                    >
                      Select sessions
                    </button>
                  )}
                  {selectMode && (
                    <>
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
                    </>
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
                      onClick={() =>
                        window.open(
                          `${API_URL}/api/download-session/${s.sessionId}/${experimentID}`
                        )
                      }
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
