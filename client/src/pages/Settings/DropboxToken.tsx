import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function DropboxToken() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const user = auth.currentUser;

  // Parámetros de Dropbox OAuth
  const CLIENT_ID = "pn9j0lbuvbmu3wl";
  const REDIRECT_URI = import.meta.env.DEV
    ? "http://localhost:5173/dropbox-callback"
    : "https://test-e4cf9.firebaseapp.com/dropbox-callback";

  const RESPONSE_TYPE = "code";
  const SCOPE = "account_info.read files.content.read files.content.write";

  const oauthUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=${RESPONSE_TYPE}&token_access_type=offline&state=${
    user?.uid
  }&scope=${encodeURIComponent(SCOPE)}`;

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

  // Función para borrar el token
  const handleDeleteToken = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        dropboxTokens: null,
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
        <a
          href={oauthUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="token-button connect"
        >
          Connect
        </a>
      )}
    </div>
  );
}
