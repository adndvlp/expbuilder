import { useState, useEffect } from "react";
import { openExternal } from "../../../lib/openExternal";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

// Detectar si estamos en Electron
const isElectron = !!(window as any).electron?.startOAuthFlow;

export default function GoogleDriveToken() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const user = auth.currentUser;

  // Parámetros de Google OAuth
  const CLIENT_ID =
    "414213417080-bgjk8udcblfgrdld33eif0cmtofl7kir.apps.googleusercontent.com";

  // REDIRECT_URI dinámico según el entorno
  const REDIRECT_URI = isElectron
    ? "http://localhost:8888/callback" // Puerto local para Electron
    : import.meta.env.DEV
      ? "http://localhost:5173/google-drive-callback"
      : "https://test-e4cf9.firebaseapp.com/google-drive-callback";

  const RESPONSE_TYPE = "code";
  const SCOPE =
    "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appfolder https://www.googleapis.com/auth/userinfo.email";

  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI,
  )}&response_type=${RESPONSE_TYPE}&scope=${encodeURIComponent(
    SCOPE,
  )}&access_type=offline&prompt=consent&state=${user?.uid}`;

  // Cargar estado del token
  useEffect(() => {
    if (!user) return;

    const loadTokenStatus = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await import("firebase/firestore").then(({ getDoc }) =>
          getDoc(docRef),
        );

        if (docSnap.exists()) {
          const data = docSnap.data();
          setHasToken(!!data.googleDriveTokens);
        }
      } catch (error) {
        console.error("Error loading token status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokenStatus();
  }, [user]);

  // Función para manejar la conexión con Google Drive
  const handleConnect = async () => {
    if (!user) return;

    // Si estamos en Electron, usar el flujo nativo
    if (isElectron) {
      setIsConnecting(true);
      try {
        const result = await (window as any).electron.startOAuthFlow({
          provider: "google-drive",
          clientId: CLIENT_ID,
          scope: SCOPE,
          state: user.uid,
        });

        if (result.success) {
          // Llamar a tu Cloud Function para intercambiar el código por tokens
          // IMPORTANTE: Pasar el redirect_uri que se usó originalmente (localhost:8888 para Electron)
          const electronRedirectUri = "http://localhost:8888/callback";
          const functionUrl = import.meta.env.DEV
            ? `http://127.0.0.1:5001/test-e4cf9/us-central1/googleDriveOAuthCallback?code=${encodeURIComponent(
                result.code,
              )}&state=${encodeURIComponent(result.state)}&redirect_uri=${encodeURIComponent(electronRedirectUri)}`
            : `https://us-central1-test-e4cf9.cloudfunctions.net/googleDriveOAuthCallback?code=${encodeURIComponent(
                result.code,
              )}&state=${encodeURIComponent(result.state)}&redirect_uri=${encodeURIComponent(electronRedirectUri)}`;

          const response = await fetch(functionUrl);

          if (response.ok || response.redirected) {
            setHasToken(true);
            alert("Google Drive connected successfully!");
          } else {
            throw new Error("Failed to exchange tokens");
          }
        } else {
          throw new Error(result.error || "OAuth flow failed");
        }
      } catch (error: any) {
        console.error("Error connecting Google Drive:", error);
        alert(`Error: ${error.message}`);
      } finally {
        setIsConnecting(false);
      }
    } else {
      // Flujo web normal (abre en navegador y redirige)
      openExternal(oauthUrl);
    }
  };

  // Función para borrar el token
  const handleDeleteToken = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        googleDriveTokens: null,
        uid: user.uid,
      });
      setHasToken(false);
    } catch (err) {
      console.error("Error deleting Google Drive token:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="token-item">
        <span className="loading-message">Loading Google Drive status...</span>
      </div>
    );
  }

  return (
    <div className="token-item">
      <div className="token-info">
        <span className="token-name">Google Drive</span>
        {hasToken ? (
          <span
            className="token-status connected"
            title="Valid Google Drive Token"
          >
            ✓ Connected
          </span>
        ) : (
          <span
            className="token-status not-connected"
            title="No válido o no conectado"
          >
            ⚠ Not connected
          </span>
        )}
      </div>
      {hasToken ? (
        <button
          onClick={handleDeleteToken}
          disabled={isDeleting}
          className="token-button disconnect"
        >
          {isDeleting ? "Disconnecting..." : "Disconnect"}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="token-button connect"
        >
          {isConnecting ? "Connecting..." : "Connect"}
        </button>
      )}
    </div>
  );
}
