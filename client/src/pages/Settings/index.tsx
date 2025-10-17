import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../../lib/firebase";
import GoogleDriveToken from "./GoogleDriveToken";
import DropboxToken from "./DropboxToken";
import GithubToken from "./GithubToken";
import ChangePassword from "./ChangePassword";
import DeleteAccount from "./DeleteAccount";
import "./index.css";

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
      navigate("/auth/login");
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setIsLoggingOut(false);
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

        {/* Notificación de OAuth */}
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

        {/* Información del usuario */}
        <div className="settings-section account-info">
          <h2 className="settings-section-title">Account Information</h2>
          <div className="account-info-item">
            <strong>Email:</strong> {user?.email}
          </div>
          <div className="account-info-item">
            <strong>UID:</strong> {user?.uid}
          </div>
        </div>

        {/* Sección de Seguridad */}
        <div className="settings-section">
          <h2 className="settings-section-title">Security</h2>
          <ChangePassword />
        </div>

        {/* Sección de Tokens */}
        <div className="settings-section">
          <h2 className="settings-section-title">Integration Tokens</h2>
          <div className="tokens-list">
            <GoogleDriveToken />
            <DropboxToken />
            <GithubToken />
          </div>
        </div>

        {/* Botón de Logout */}
        <div className="settings-section logout-section">
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
        <div className="settings-section logout-section">
          <h2 className="settings-section-title">Danger Zone</h2>
          <DeleteAccount />
        </div>
      </div>
    </div>
  );
}
