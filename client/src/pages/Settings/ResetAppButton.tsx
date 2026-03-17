import React, { useState } from "react";
import { auth } from "../../lib/firebase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const ResetAppButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deleteRepos, setDeleteRepos] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Obtener el uid real del usuario validado en Firebase
  const uid = auth.currentUser?.uid || null;

  const handleReset = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/app/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uid,
          deleteRepos: deleteRepos,
        }),
      });

      const data = await resp.json();
      if (data.success) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      } else {
        alert("Ocurrió un error borrando la app: " + data.error);
      }
    } catch (e) {
      alert("Error crítico conectando con el servidor");
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid #f44336",
        borderRadius: 8,
        background: "#ffebee",
      }}
    >
      <h3
        style={{
          fontSize: 18,
          fontWeight: "bold",
          color: "#d32f2f",
          marginBottom: 8,
        }}
      >
        {" "}
        Factory Reset App
      </h3>
      <p style={{ color: "#333", marginBottom: 16 }}>
        Resetting the app will permanently delete ALL your locally saved data on
        this computer.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            background: "#d32f2f",
            color: "white",
            padding: "8px 16px",
            borderRadius: 4,
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Delete all my data
        </button>
      ) : (
        <div
          style={{
            background: "#ffcdd2",
            padding: 16,
            border: "1px solid #ef9a9a",
            borderRadius: 4,
          }}
        >
          <p style={{ fontWeight: "bold", color: "#b71c1c", marginBottom: 12 }}>
            Are you absolutely sure?
          </p>

          {uid && (
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  color: "#b71c1c",
                }}
              >
                <input
                  type="checkbox"
                  checked={deleteRepos}
                  onChange={(e) => setDeleteRepos(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#d32f2f" }}
                />
                <span>
                  Also delete my GitHub Repositories associated with the
                  experiments in the cloud.
                </span>
              </label>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleReset}
              disabled={loading}
              style={{
                background: "#b71c1c",
                color: "white",
                padding: "8px 16px",
                borderRadius: 4,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                fontWeight: "bold",
              }}
            >
              {loading ? "Deleting..." : "Yes, permanently delete"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              style={{
                background: "#9e9e9e",
                color: "white",
                padding: "8px 16px",
                borderRadius: 4,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                fontWeight: "bold",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResetAppButton;
