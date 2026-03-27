import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../lib/firebase";
import GoogleDriveToken from "./GoogleDrive/GoogleDriveToken";
import DropboxToken from "./Dropbox/DropboxToken";
import GithubToken from "./Github/GithubToken";
import OsfToken from "./OsfToken";
import ChangePassword from "./ChangePassword";
import DeleteAccount from "./DeleteAccount";
import ResetAppButton from "./ResetAppButton";
import FirebaseCredentials from "./FirebaseCredentials";
import "./index.css";

const API_URL = import.meta.env.VITE_API_URL;

interface Experiment {
  experimentID: string;
  name: string;
}

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Experiments list for export selector
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExpIDs, setSelectedExpIDs] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/load-experiments`)
      .then((r) => r.json())
      .then((data) => setExperiments(data.experiments || []))
      .catch(() => {});
  }, []);

  // Handle OAuth callback notifications
  useEffect(() => {
    const status = searchParams.get("status");
    const service = searchParams.get("service");
    const errorMessage = searchParams.get("message");

    if (status && service) {
      if (status === "success") {
        setNotification({
          type: "success",
          message: `${service.charAt(0).toUpperCase() + service.slice(1)} connected successfully!`,
        });
      } else if (status === "error") {
        setNotification({
          type: "error",
          message: `Error connecting ${service}: ${errorMessage || "Unknown error"}`,
        });
      }

      setSearchParams({});

      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await auth.signOut();
      localStorage.removeItem("user");
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const importInputRef = useRef<HTMLInputElement>(null);

  /** Fetches a ZIP from a server response and saves it via Electron save dialog */
  const saveZipFromResponse = async (response: Response, filename: string) => {
    const arrayBuffer = await response.arrayBuffer();
    // @ts-ignore
    const result = await window.electron.saveZipFile(
      Array.from(new Uint8Array(arrayBuffer)),
      filename,
    );
    return result;
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${API_URL}/api/export-all-experiments`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Error exporting experiments");
      }
      const date = new Date().toISOString().slice(0, 10);
      const result = await saveZipFromResponse(
        res,
        `experiments-backup-${date}.zip`,
      );
      if (result.success) {
        setNotification({
          type: "success",
          message: "All experiments exported!",
        });
      } else if (result.error !== "Cancelled") {
        setNotification({
          type: "error",
          message: result.error || "Export failed",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Export failed",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedExpIDs.size === 0) return;
    setIsExporting(true);
    try {
      if (selectedExpIDs.size === 1) {
        const [expID] = [...selectedExpIDs];
        const exp = experiments.find((e) => e.experimentID === expID);
        const res = await fetch(`${API_URL}/api/export-experiment/${expID}`);
        if (!res.ok) throw new Error("Export failed");
        const safeName = (exp?.name || expID).replace(/[^a-zA-Z0-9\-_]/g, "_");
        const result = await saveZipFromResponse(res, `${safeName}-backup.zip`);
        if (result.success) {
          setNotification({ type: "success", message: "Experiment exported!" });
        } else if (result.error !== "Cancelled") {
          setNotification({
            type: "error",
            message: result.error || "Export failed",
          });
        }
      } else {
        const ids = [...selectedExpIDs].join(",");
        const res = await fetch(
          `${API_URL}/api/export-all-experiments?ids=${encodeURIComponent(ids)}`,
        );
        if (!res.ok) throw new Error("Export failed");
        const date = new Date().toISOString().slice(0, 10);
        const result = await saveZipFromResponse(
          res,
          `experiments-backup-${date}.zip`,
        );
        if (result.success) {
          setNotification({
            type: "success",
            message: `${selectedExpIDs.size} experiments exported!`,
          });
        } else if (result.error !== "Cancelled") {
          setNotification({
            type: "error",
            message: result.error || "Export failed",
          });
        }
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Export failed",
      });
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
      setSelectedExpIDs(new Set());
    }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("zipfile", file);
    try {
      const res = await fetch(`${API_URL}/api/import-experiments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: "success",
          message: `${data.imported} experiment(s) imported successfully!`,
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to import",
        });
      }
    } catch {
      setNotification({ type: "error", message: "Failed to import" });
    }
    e.target.value = "";
  };

  if (authLoading) {
    return (
      <div
        className="settings-bg"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ color: "#3d92b4", fontSize: 18, fontWeight: 600 }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="settings-bg">
      {/* Navigation */}
      <div
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1000,
          display: "flex",
          gap: "8px",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            background: "#3d92b4",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          ←
        </button>
      </div>

      {/* Export selector modal */}
      {showExportModal && (
        <div
          className="backup-modal-overlay"
          onClick={() => setShowExportModal(false)}
        >
          <div className="backup-modal" onClick={(e) => e.stopPropagation()}>
            <p className="backup-modal-title">Export experiments</p>
            <p className="backup-modal-subtitle">
              Each experiment exports as a folder with data.json + media files
            </p>
            <div className="backup-modal-list">
              <label className="backup-modal-select-all">
                <input
                  type="checkbox"
                  checked={
                    experiments.length > 0 &&
                    selectedExpIDs.size === experiments.length
                  }
                  onChange={(e) =>
                    setSelectedExpIDs(
                      e.target.checked
                        ? new Set(experiments.map((x) => x.experimentID))
                        : new Set(),
                    )
                  }
                />
                Select all ({experiments.length})
              </label>
              {experiments.map((exp) => (
                <label key={exp.experimentID} className="backup-modal-item">
                  <input
                    type="checkbox"
                    checked={selectedExpIDs.has(exp.experimentID)}
                    onChange={(e) => {
                      const next = new Set(selectedExpIDs);
                      if (e.target.checked) next.add(exp.experimentID);
                      else next.delete(exp.experimentID);
                      setSelectedExpIDs(next);
                    }}
                  />
                  {exp.name || exp.experimentID}
                </label>
              ))}
            </div>
            <div className="backup-modal-footer">
              <span className="backup-modal-count">
                {selectedExpIDs.size} of {experiments.length} selected
              </span>
              <div className="backup-modal-buttons">
                <button
                  className="backup-modal-cancel"
                  onClick={() => {
                    setShowExportModal(false);
                    setSelectedExpIDs(new Set());
                  }}
                >
                  Cancel
                </button>
                <button
                  className="backup-modal-export"
                  onClick={handleExportSelected}
                  disabled={selectedExpIDs.size === 0 || isExporting}
                >
                  {isExporting
                    ? "Exporting..."
                    : `Export (${selectedExpIDs.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>

        {notification && (
          <div className={`notification notification-${notification.type}`}>
            {notification.message}
            <button
              className="notification-close"
              onClick={() => setNotification(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* Backup & Restore */}
        <div className="settings-section">
          <h2 className="settings-section-title">Backup & Restore</h2>
          <input
            type="file"
            accept="application/zip,.zip"
            style={{ display: "none" }}
            ref={importInputRef}
            onChange={handleImportZip}
          />
          <div className="backup-grid">
            {/* Import card */}
            <div className="backup-card backup-card-import">
              <div className="backup-card-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 3a1 1 0 0 1 1 1v11.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 15.586V4a1 1 0 0 1 1-1Z"
                  />
                  <path
                    fill="currentColor"
                    d="M4 19a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2H4Z"
                  />
                </svg>
              </div>
              <span className="backup-card-label">Import Backup</span>
              <span className="backup-card-desc">
                Restore experiments from a .zip backup. Existing experiments
                with the same ID will be updated.
              </span>
              <div className="backup-card-actions">
                <button
                  className="backup-btn backup-btn-primary"
                  onClick={() => importInputRef.current?.click()}
                >
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 3a1 1 0 0 1 1 1v11.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 15.586V4a1 1 0 0 1 1-1Z"
                    />
                    <path
                      fill="currentColor"
                      d="M4 19a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2H4Z"
                    />
                  </svg>
                  Choose .zip file
                </button>
              </div>
            </div>

            {/* Export card */}
            <div className="backup-card backup-card-export">
              <div className="backup-card-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 2a1 1 0 0 1 1 1v11.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 14.586V3a1 1 0 0 1 1-1Z"
                    transform="scale(1,-1) translate(0,-24)"
                  />
                  <path
                    fill="currentColor"
                    d="M11 3a1 1 0 0 1 2 0v11.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 14.586V3Z"
                    transform="rotate(180 12 12)"
                  />
                  <path
                    fill="currentColor"
                    d="M4 19a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2H4Z"
                  />
                </svg>
              </div>
              <span className="backup-card-label">Export Experiments</span>
              <span className="backup-card-desc">
                Save experiments as a .zip — one folder per experiment with
                data.json and media files (img/, aud/, vid/).
                {experiments.length > 0 && (
                  <>
                    {" "}
                    <strong style={{ color: "#e57373" }}>
                      {experiments.length} experiment
                      {experiments.length !== 1 ? "s" : ""} available.
                    </strong>
                  </>
                )}
              </span>
              <div className="backup-card-actions">
                <button
                  className="backup-btn backup-btn-danger"
                  onClick={handleExportAll}
                  disabled={isExporting || experiments.length === 0}
                >
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 2a1 1 0 0 0-1 1v11.586L7.707 11.293a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0-1.414-1.414L13 14.586V3a1 1 0 0 0-1-1Z"
                      transform="rotate(180 12 12)"
                    />
                    <path
                      fill="currentColor"
                      d="M4 19a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2H4Z"
                    />
                  </svg>
                  {isExporting ? "Exporting..." : "Export all"}
                </button>
                <button
                  className="backup-btn backup-btn-secondary"
                  onClick={() => {
                    setSelectedExpIDs(new Set());
                    setShowExportModal(true);
                  }}
                  disabled={experiments.length === 0}
                >
                  Export selected...
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Firebase Credentials */}
        <div className="settings-section">
          <h2 className="settings-section-title">Firebase Configuration</h2>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
            Configure your own Firebase project credentials. This allows you to
            connect the app to your own Firebase backend.
          </div>
          <FirebaseCredentials />
        </div>

        {!user && (
          <div style={{ marginBottom: 24 }}>
            <ResetAppButton />
          </div>
        )}

        {/* Blurred sections when not logged in */}
        <div style={{ position: "relative" }}>
          <div
            className="settings-section account-info"
            style={!user ? { filter: "blur(4px)", pointerEvents: "none" } : {}}
          >
            <h2 className="settings-section-title">Account Information</h2>
            <div className="account-info-item">
              <strong>Email:</strong> {user?.email}
            </div>
            <div className="account-info-item">
              <strong>UID:</strong> {user?.uid}
            </div>
          </div>

          <div
            className="settings-section"
            style={!user ? { filter: "blur(4px)", pointerEvents: "none" } : {}}
          >
            <h2 className="settings-section-title">Integration Tokens</h2>
            <div className="tokens-list">
              <GoogleDriveToken />
              <DropboxToken />
              <GithubToken />
              <OsfToken />
            </div>
          </div>

          <div
            className="settings-section"
            style={!user ? { filter: "blur(4px)", pointerEvents: "none" } : {}}
          >
            <h2 className="settings-section-title">Security</h2>
            <ChangePassword />
          </div>

          <div
            className="settings-section logout-section"
            style={!user ? { filter: "blur(4px)", pointerEvents: "none" } : {}}
          >
            <h2 className="settings-section-title">Session</h2>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="logout-button"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>

          <div
            className="settings-section logout-section"
            style={!user ? { filter: "blur(1px)", pointerEvents: "none" } : {}}
          >
            <h2 className="settings-section-title">Danger Zone</h2>
            <DeleteAccount />
            {user && <ResetAppButton />}
          </div>

          {!user && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.3)",
                backdropFilter: "blur(2px)",
              }}
            >
              <div
                style={{
                  background: "#fffbe6",
                  color: "#b7950b",
                  padding: "32px 40px",
                  borderRadius: 12,
                  boxShadow: "0 4px 24px rgba(183,149,11,0.12)",
                  fontSize: 22,
                  fontWeight: 700,
                  marginBottom: 24,
                  textAlign: "center",
                  border: "2px solid #b7950b",
                  maxWidth: 400,
                }}
              >
                You need an account to access these settings.
                <button
                  onClick={() => navigate("/auth/login")}
                  style={{
                    marginTop: 24,
                    padding: "12px 32px",
                    borderRadius: 8,
                    background: "#b7950b",
                    color: "white",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(183,149,11,0.12)",
                    transition: "background 0.2s ease",
                  }}
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
