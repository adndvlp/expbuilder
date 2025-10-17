import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./index.css";

export default function DropboxCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      // Si el usuario rechazó el acceso
      if (error) {
        navigate(
          `/settings?status=error&service=dropbox&message=${encodeURIComponent(error)}`
        );
        return;
      }

      // Si faltan parámetros
      if (!code || !state) {
        navigate(
          "/settings?status=error&service=dropbox&message=Missing parameters"
        );
        return;
      }

      try {
        // Determinar la URL del Cloud Function
        const isDev = import.meta.env.DEV;
        const functionUrl = isDev
          ? `http://127.0.0.1:5001/test-e4cf9/us-central1/dropboxOAuthCallback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
          : `https://us-central1-test-e4cf9.cloudfunctions.net/dropboxOAuthCallback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

        // Llamar al Cloud Function - éste guardará los tokens y redirigirá
        window.location.href = functionUrl;
      } catch (err: any) {
        navigate(
          `/settings?status=error&service=dropbox&message=${encodeURIComponent(err.message)}`
        );
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="settings-bg">
      <div className="settings-container">
        <div
          className="settings-section"
          style={{ textAlign: "center", padding: "60px 24px" }}
        >
          <div className="spinner" />
          <h2 style={{ marginTop: "20px" }}>Connecting Dropbox...</h2>
          <p style={{ color: "#666" }}>Processing authentication</p>
        </div>
      </div>
    </div>
  );
}
