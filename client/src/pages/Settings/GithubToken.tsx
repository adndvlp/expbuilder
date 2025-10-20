import { useState, useEffect } from "react";
import { openExternal } from "../../lib/openExternal";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// Detectar si estamos en Electron
const isElectron = !!(window as any).electron?.startOAuthFlow;

export default function GithubToken() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const user = auth.currentUser;

  // Parámetros de GitHub OAuth
  const CLIENT_ID = "Ov23limim0vbyTd5J4fK";

  // REDIRECT_URI dinámico según el entorno
  const REDIRECT_URI = isElectron
    ? "http://localhost:8888/callback" // Puerto local para Electron
    : import.meta.env.DEV
      ? "http://localhost:5173/github-callback"
      : "https://test-e4cf9.firebaseapp.com/github-callback";

  const SCOPE = "public_repo delete_repo workflow";

  const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=${encodeURIComponent(SCOPE)}&state=${user?.uid}`;

  // Cargar estado del token
  useEffect(() => {
    if (!user) return;

    const loadTokenStatus = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await import("firebase/firestore").then(({ getDoc }) =>
          getDoc(docRef)
        );

        if (docSnap.exists()) {
          const data = docSnap.data();
          setHasToken(!!data.githubTokens);
        }
      } catch (error) {
        console.error("Error loading token status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokenStatus();
  }, [user]);

  // Función para manejar la conexión con GitHub
  const handleConnect = async () => {
    if (!user) return;

    // Si estamos en Electron, usar el flujo nativo
    if (isElectron) {
      setIsConnecting(true);
      try {
        const result = await (window as any).electron.startOAuthFlow({
          provider: "github",
          clientId: CLIENT_ID,
          scope: SCOPE,
          state: user.uid,
        });

        if (result.success) {
          // Llamar a tu Cloud Function para intercambiar el código por tokens
          // IMPORTANTE: Pasar el redirect_uri que se usó originalmente
          const functionUrl = import.meta.env.DEV
            ? `http://127.0.0.1:5001/test-e4cf9/us-central1/githubOAuthCallback?code=${encodeURIComponent(
                result.code
              )}&state=${encodeURIComponent(result.state)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
            : `https://us-central1-test-e4cf9.cloudfunctions.net/githubOAuthCallback?code=${encodeURIComponent(
                result.code
              )}&state=${encodeURIComponent(result.state)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

          const response = await fetch(functionUrl);

          if (response.ok || response.redirected) {
            setHasToken(true);
            alert("GitHub connected successfully!");
          } else {
            throw new Error("Failed to exchange tokens");
          }
        } else {
          throw new Error(result.error || "OAuth flow failed");
        }
      } catch (error: any) {
        console.error("Error connecting GitHub:", error);
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
        githubTokens: null,
        uid: user.uid,
      });
      setHasToken(false);
    } catch (err) {
      console.error("Error deleting GitHub token:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="token-item">
        <span className="loading-message">Loading GitHub status...</span>
      </div>
    );
  }

  return (
    <div className="token-item">
      <div className="token-info">
        <span className="token-name">GitHub</span>
        {hasToken ? (
          <span className="token-status connected" title="Valid GitHub Token">
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
