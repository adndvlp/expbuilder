import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function GithubToken() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const user = auth.currentUser;

  // Parámetros de GitHub OAuth
  const CLIENT_ID = "Ov23limim0vbyTd5J4fK";
  const REDIRECT_URI = import.meta.env.DEV
    ? "http://localhost:5173/github-callback"
    : "https://test-e4cf9.firebaseapp.com/github-callback";

  const SCOPE = "repo delete_repo workflow";

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
