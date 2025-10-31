import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../../lib/firebase";
import GoogleDriveToken from "./GoogleDriveToken";
import DropboxToken from "./DropboxToken";
import GithubToken from "./GithubToken";
import ChangePassword from "./ChangePassword";
import DeleteAccount from "./DeleteAccount";
import "./index.css";
const API_URL = import.meta.env.VITE_API_URL;

export default function Settings() {
  const user = auth.currentUser;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Manejar notificaciones de OAuth callbacks
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

      // Limpiar parámetros de URL
      setSearchParams({});

      // Auto-ocultar notificación después de 5 segundos
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

  // Referencia para el input de importación
  const importInputRef = useRef<HTMLInputElement>(null);

  // Exportar db.json usando Electron (guardar en carpeta elegida)
  const handleExportDb = async () => {
    try {
      const res = await fetch(`${API_URL}/api/export-db`);
      if (!res.ok) throw new Error("Error downloading db.json");
      const jsonText = await res.text();
      // @ts-ignore
      const result = await window.electron.saveJsonFile(jsonText, "db.json");
      if (result.success) {
        setNotification({
          type: "success",
          message: "Database exported successfully!",
        });
      } else {
        setNotification({
          type: "error",
          message:
            "Failed to export database: " + (result.error || "Unknown error"),
        });
      }
    } catch (err) {
      setNotification({ type: "error", message: "Failed to export database" });
    }
  };

  // Importar db.json
  const handleImportDb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("dbfile", file);
    try {
      const res = await fetch(`${API_URL}/api/import-db`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: "success",
          message: "Database imported successfully!",
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to import database",
        });
      }
    } catch (err) {
      setNotification({ type: "error", message: "Failed to import database" });
    }
  };

  return (
    <div className="settings-bg">
      {/* Botones de navegación */}
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
      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>
        {/* Notificación de OAuth y export/import */}
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
        {/* Exportar/Importar datos (siempre visible) */}
        <div className="settings-section">
          <h2 className="settings-section-title">Backup & Restore</h2>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button
              onClick={() => importInputRef.current?.click()}
              className="import-db-btn"
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                background: "linear-gradient(90deg,#3d92b4 60%,#4fc3f7 100%)",
                color: "white",
                border: "none",
                fontWeight: 600,
                fontSize: 16,
                boxShadow: "0 2px 8px rgba(61,146,180,0.08)",
                cursor: "pointer",
                transition: "background 0.2s ease",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background =
                  "linear-gradient(90deg,#4fc3f7 60%,#3d92b4 100%)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background =
                  "linear-gradient(90deg,#3d92b4 60%,#4fc3f7 100%)")
              }
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  style={{ verticalAlign: "middle" }}
                >
                  <path
                    fill="currentColor"
                    d="M12 7.5a1 1 0 0 1 1 1v10.09l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 1.4-1.42l3.3 3.3V8.5a1 1 0 0 1 1-1Z"
                  />
                  <path
                    fill="currentColor"
                    d="M5 6a1 1 0 0 1-1-1V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a1 1 0 1 1-2 0V4H7v1a1 1 0 0 1-1 1Z"
                  />
                </svg>
                Import Data
              </span>
            </button>
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              ref={importInputRef}
              onChange={handleImportDb}
            />
            <button
              onClick={handleExportDb}
              className="export-db-btn"
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                background: "linear-gradient(90deg,#e57373 60%,#ffb74d 100%)",
                color: "white",
                border: "none",
                fontWeight: 600,
                fontSize: 16,
                boxShadow: "0 2px 8px rgba(229,115,115,0.08)",
                cursor: "pointer",
                transition: "background 0.2s ease",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background =
                  "linear-gradient(90deg,#ffb74d 60%,#e57373 100%)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background =
                  "linear-gradient(90deg,#e57373 60%,#ffb74d 100%)")
              }
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  style={{ verticalAlign: "middle" }}
                >
                  <path
                    fill="currentColor"
                    d="M12 16.5a1 1 0 0 1-1-1V5.41l-3.3 3.3a1 1 0 1 1-1.4-1.42l5-5a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1-1.4 1.42l-3.3-3.3V15.5a1 1 0 0 1-1 1Z"
                  />
                  <path
                    fill="currentColor"
                    d="M19 18a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a1 1 0 1 1 2 0v1h10v-1a1 1 0 0 1 1-1Z"
                  />
                </svg>
                Export Data
              </span>
            </button>
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
            Export your data to restore it later if you reinstall the app.
          </div>
        </div>
        {/* Overlay borroso solo para secciones de usuario hacia abajo */}
        <div style={{ position: "relative" }}>
          {/* Información del usuario */}
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

          {/* Sección de Tokens */}
          <div
            className="settings-section"
            style={!user ? { filter: "blur(4px)", pointerEvents: "none" } : {}}
          >
            <h2 className="settings-section-title">Integration Tokens</h2>
            <div className="tokens-list">
              <GoogleDriveToken />
              <DropboxToken />
              <GithubToken />
            </div>
          </div>

          {/* Sección de Seguridad */}
          <div
            className="settings-section"
            style={!user ? { filter: "blur(4px)", pointerEvents: "none" } : {}}
          >
            <h2 className="settings-section-title">Security</h2>
            <ChangePassword />
          </div>

          {/* Botón de Logout */}
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

          {/* Zona de Peligro */}
          <div
            className="settings-section logout-section"
            style={!user ? { filter: "blur(1px)", pointerEvents: "none" } : {}}
          >
            <h2 className="settings-section-title">Danger Zone</h2>
            <DeleteAccount />
          </div>

          {/* Si no hay usuario, mostrar el overlay borroso y el mensaje SOLO sobre estas secciones */}
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
