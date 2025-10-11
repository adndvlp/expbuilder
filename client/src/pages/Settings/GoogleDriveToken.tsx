import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function GoogleDriveToken() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const user = auth.currentUser;

  // Parámetros de Google OAuth
  const CLIENT_ID =
    "414213417080-bgjk8udcblfgrdld33eif0cmtofl7kir.apps.googleusercontent.com";
  const REDIRECT_URI = import.meta.env.DEV
    ? "http://localhost:5173/google-drive-callback"
    : "https://test-e4cf9.firebaseapp.com/google-drive-callback";

  const RESPONSE_TYPE = "code";
  const SCOPE =
    "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appfolder https://www.googleapis.com/auth/userinfo.email";

  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=${RESPONSE_TYPE}&scope=${encodeURIComponent(
    SCOPE
  )}&access_type=offline&prompt=consent&state=${user?.uid}`;

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

  // Función para borrar el token
  const handleDeleteToken = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        googleDriveTokens: null,
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
