import { useState, useEffect } from "react";
import { openExternal } from "../../../lib/openExternal";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { fetchOAuthState } from "../../../lib/oauthState";

// Detectar si estamos en Electron
const isElectron = !!(window as any).electron?.startOAuthFlow;

export default function DropboxToken() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const user = auth.currentUser;

  // Parámetros de Dropbox OAuth
  const CLIENT_ID = "pn9j0lbuvbmu3wl";

  // REDIRECT_URI dinámico según el entorno
  const REDIRECT_URI = isElectron
    ? "http://localhost:8888/callback" // Puerto local para Electron
    : import.meta.env.DEV
      ? "http://localhost:5173/dropbox-callback"
      : "https://test-e4cf9.firebaseapp.com/dropbox-callback";

  const RESPONSE_TYPE = "code";
  const SCOPE = "account_info.read files.content.read files.content.write";

  // T-5: OAuth `state` is now obtained from the backend (server-signed HMAC)
  // immediately before the redirect. Built dynamically in `handleConnect`.
  const buildOAuthUrl = (state: string) =>
    `https://www.dropbox.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI,
    )}&response_type=${RESPONSE_TYPE}&token_access_type=offline&state=${encodeURIComponent(
      state,
    )}&scope=${encodeURIComponent(SCOPE)}`;

  // Cargar estado del token
  useEffect(() => {
    if (!user) {
      setHasToken(false);
      setIsLoading(false);
      return;
    }

    const loadTokenStatus = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await import("firebase/firestore").then(({ getDoc }) =>
          getDoc(docRef),
        );

        if (docSnap.exists()) {
          const data = docSnap.data();
          setHasToken(!!data.dropboxTokens);
        }
      } catch (error) {
        console.error("Error loading token status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokenStatus();
  }, [user]);

  // Función para manejar la conexión con Dropbox
  const handleConnect = async () => {
    if (!user) return;

    // T-5: fetch signed state from backend before any redirect.
    let signedState: string;
    try {
      signedState = await fetchOAuthState("dropbox");
    } catch (err: any) {
      console.error("Failed to obtain OAuth state:", err);
      alert(`Could not start OAuth flow: ${err.message}`);
      return;
    }

    // Si estamos en Electron, usar el flujo nativo
    if (isElectron) {
      setIsConnecting(true);
      try {
        const result = await (window as any).electron.startOAuthFlow({
          provider: "dropbox",
          clientId: CLIENT_ID,
          scope: SCOPE,
          state: signedState,
        });

        if (result.success) {
          // Llamar a tu Cloud Function para intercambiar el código por tokens
          // IMPORTANTE: Pasar el redirect_uri que se usó originalmente (localhost:8888 para Electron)
          const electronRedirectUri = "http://localhost:8888/callback";
          const functionUrl = import.meta.env.DEV
            ? `http://127.0.0.1:5001/test-e4cf9/us-central1/dropboxOAuthCallback?code=${encodeURIComponent(
                result.code,
              )}&state=${encodeURIComponent(result.state)}&redirect_uri=${encodeURIComponent(electronRedirectUri)}`
            : `https://us-central1-test-e4cf9.cloudfunctions.net/dropboxOAuthCallback?code=${encodeURIComponent(
                result.code,
              )}&state=${encodeURIComponent(result.state)}&redirect_uri=${encodeURIComponent(electronRedirectUri)}`;

          const response = await fetch(functionUrl);

          if (response.ok || response.redirected) {
            setHasToken(true);
            alert("Dropbox connected successfully!");
          } else {
            throw new Error("Failed to exchange tokens");
          }
        } else {
          throw new Error(result.error || "OAuth flow failed");
        }
      } catch (error: any) {
        console.error("Error connecting Dropbox:", error);
        alert(`Error: ${error.message}`);
      } finally {
        setIsConnecting(false);
      }
    } else {
      // Flujo web normal (abre en navegador y redirige) — usa state firmado.
      openExternal(buildOAuthUrl(signedState));
    }
  };

  // Función para borrar el token
  const handleDeleteToken = async () => {
    /* v8 ignore start -- disconnect button is only rendered from a signed-in token state. */
    if (!user) return;
    /* v8 ignore stop */

    setIsDeleting(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        dropboxTokens: null,
        uid: user.uid,
      });
      setHasToken(false);
    } catch (err) {
      console.error("Error deleting Dropbox token:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="token-item">
        <span className="loading-message">Loading Dropbox status...</span>
      </div>
    );
  }

  return (
    <div className="token-item">
      <div className="token-info">
        <span className="token-name">Dropbox</span>
        {hasToken ? (
          <span className="token-status connected" title="Valid Dropbox Token">
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
