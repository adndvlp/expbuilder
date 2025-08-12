import { useEffect, useState } from "react";
import ExperimentPreview from "./ExperimentPreview";

type SessionMeta = {
  _id: string;
  sessionId: string;
  createdAt: string;
};

export default function ResultsList() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    const res = await fetch("/api/session-results");
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [ExperimentPreview]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to delete this session result?"))
      return;
    await fetch(`/api/session-results/${sessionId}`, { method: "DELETE" });
    fetchSessions();
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
                <th>Session ID</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id}>
                  <td>{s.sessionId}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      className="download-csv-btn"
                      onClick={() =>
                        window.open(`/api/download-session/${s.sessionId}`)
                      }
                    >
                      Download CSV
                    </button>
                    <button
                      className="remove-button"
                      onClick={() => handleDeleteSession(s.sessionId)}
                    >
                      Delete
                    </button>
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
