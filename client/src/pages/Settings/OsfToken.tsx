import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { openExternal } from "../../lib/openExternal";

// Detectar si estamos en Electron
const isElectron = !!(window as any).electron?.startOAuthFlow;

export default function OsfToken() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [projectIdInput, setProjectIdInput] = useState("");
  const [error, setError] = useState("");
  const [osfUserName, setOsfUserName] = useState("");
  const [osfProjectId, setOsfProjectId] = useState("");
  const user = auth.currentUser;

  // OSF OAuth credentials
  const CLIENT_ID = "ee4514d3235d4acb8da4443b3516ede2";

  // REDIRECT_URI dinámico según el entorno
  const REDIRECT_URI = isElectron
    ? "http://localhost:8888/oauth/osf/callback"
    : import.meta.env.DEV
      ? "http://localhost:5173/oauth/osf/callback"
      : "https://us-central1-builder-f43c3.cloudfunctions.net/osfOAuthCallback";

  const oauthUrl = `https://accounts.osf.io/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI,
  )}&scope=${encodeURIComponent(
    "osf.full_read osf.full_write",
  )}&access_type=offline&approval_prompt=auto&state=${user?.uid}`;

  // Cargar estado del token
  useEffect(() => {
    if (!user) return;

    const loadTokenStatus = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          // Verificar si tiene OAuth tokens o token manual
          const hasOAuthToken = !!data.osfTokens?.access_token;
          const hasManualToken = !!data.osfToken && data.osfTokenValid;
          setHasToken(hasOAuthToken || hasManualToken);
          setOsfUserName(data.osfUserName || "");
          setOsfProjectId(data.osfProjectId || "");
        }
      } catch (error) {
        console.error("Error loading token status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokenStatus();
  }, [user]);

  // Función para manejar la conexión con OSF OAuth
  const handleConnectOAuth = async (retryAttempt = 0) => {
    if (!user) return;

    // Si estamos en Electron, usar el flujo nativo
    if (isElectron) {
      setIsConnecting(true);

      // Si es el primer intento, dar tiempo a que OSF propague la configuración
      if (retryAttempt === 0) {
        setError(
          "Opening OSF authorization... If it fails, it will retry automatically.",
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      try {
        const result = await (window as any).electron.startOAuthFlow({
          provider: "osf",
          clientId: CLIENT_ID,
          scope: "osf.full_read osf.full_write",
          state: user.uid,
        });

        if (result.success) {
          // Llamar a la Cloud Function para intercambiar el código por tokens
          const electronRedirectUri = "http://localhost:8888/callback";
          const functionUrl = import.meta.env.DEV
            ? `http://127.0.0.1:5001/test-e4cf9/us-central1/osfOAuthCallback?code=${encodeURIComponent(
                result.code,
              )}&state=${encodeURIComponent(result.state)}&redirect_uri=${encodeURIComponent(electronRedirectUri)}`
            : `https://us-central1-test-e4cf9.cloudfunctions.net/osfOAuthCallback?code=${encodeURIComponent(
                result.code,
              )}&state=${encodeURIComponent(result.state)}&redirect_uri=${encodeURIComponent(electronRedirectUri)}`;

          const response = await fetch(functionUrl);

          if (response.ok || response.redirected) {
            // Recargar el estado del token
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              setHasToken(!!data.osfTokens?.access_token);
              setOsfUserName(data.osfUserName || "");
              setOsfProjectId(data.osfProjectId || "");
            }
            alert("OSF connected successfully via OAuth!");
          } else {
            throw new Error("Failed to exchange tokens");
          }
        } else {
          // Si el error es invalid_client y no hemos reintentado aún
          if (result.error?.includes("invalid_client") && retryAttempt < 2) {
            setError(
              `OSF configuration is propagating... Retrying (attempt ${retryAttempt + 2}/3)`,
            );
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Esperar 3 segundos
            return handleConnectOAuth(retryAttempt + 1);
          }
          throw new Error(result.error || "OAuth flow failed");
        }
      } catch (error: any) {
        console.error("Error connecting OSF:", error);

        // Mensaje más útil para el usuario
        if (error.message?.includes("invalid_client")) {
          setError(
            "OSF OAuth configuration error. Please ensure your application is properly configured at https://osf.io/settings/applications/ and try again in a few seconds.",
          );
        } else {
          setError(`Connection failed: ${error.message}`);
        }
      } finally {
        setIsConnecting(false);
      }
    } else {
      // Flujo web normal (abre en navegador y redirige)
      openExternal(oauthUrl);
    }
  };

  // Función para guardar el token de OSF manualmente
  const handleSaveToken = async () => {
    if (!user || !tokenInput.trim()) {
      setError("Please enter a valid token");
      return;
    }

    if (!projectIdInput.trim()) {
      setError("Please enter a valid OSF Project ID");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      // Llamar a la Cloud Function para validar y guardar el token
      const functionUrl = import.meta.env.DEV
        ? `http://127.0.0.1:5001/test-e4cf9/us-central1/osfManage`
        : `https://us-central1-test-e4cf9.cloudfunctions.net/osfManage`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "saveToken",
          uid: user.uid,
          token: tokenInput,
          projectId: projectIdInput,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setHasToken(true);
        setOsfUserName(data.userName || "");
        setOsfProjectId(projectIdInput);
        setShowTokenInput(false);
        setTokenInput("");
        setProjectIdInput("");
        alert("OSF token saved successfully!");
      } else {
        setError(data.message || "Failed to save token");
      }
    } catch (err) {
      console.error("Error saving OSF token:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Error saving token";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Función para borrar el token
  const handleDeleteToken = async () => {
    if (!user) return;

    if (
      !confirm(
        "Are you sure you want to disconnect OSF? This will remove your token.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      // Llamar a la Cloud Function para desconectar OSF
      const functionUrl = import.meta.env.DEV
        ? `http://127.0.0.1:5001/test-e4cf9/us-central1/osfManage`
        : `https://us-central1-test-e4cf9.cloudfunctions.net/osfManage`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "disconnect",
          uid: user.uid,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setHasToken(false);
        setOsfUserName("");
        setOsfProjectId("");
        alert("OSF disconnected successfully!");
      } else {
        throw new Error(data.message || "Failed to disconnect");
      }
    } catch (err) {
      console.error("Error deleting OSF token:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Error disconnecting OSF";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="token-item">
        <span className="loading-message">Loading OSF status...</span>
      </div>
    );
  }

  return (
    <div className="token-item">
      <div className="token-info">
        <span className="token-name">OSF (Open Science Framework)</span>
        {hasToken ? (
          <span className="token-status connected" title="Valid OSF Token">
            ✓ Connected
            {osfUserName && ` (${osfUserName})`}
            {osfProjectId && (
              <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>
                | Project: {osfProjectId}
              </span>
            )}
          </span>
        ) : (
          <span className="token-status disconnected" title="No OSF Token">
            ✗ Not Connected
          </span>
        )}
      </div>
      <div className="token-actions">
        {hasToken ? (
          <button
            onClick={handleDeleteToken}
            disabled={isDeleting}
            className="token-button disconnect"
          >
            {isDeleting ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: "100%",
            }}
          >
            {/* Botón de OAuth */}
            <button
              onClick={() => handleConnectOAuth(0)}
              disabled={isConnecting}
              className="token-button connect"
              style={{
                background: "linear-gradient(90deg, #3d92b4 60%, #4fc3f7 100%)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {isConnecting ? "Connecting..." : "🔐 Connect with OSF OAuth"}
            </button>

            {/* Mensaje de estado/error */}
            {error && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 4,
                  background:
                    error.includes("Retrying") || error.includes("Opening")
                      ? "#e3f2fd"
                      : "#ffebee",
                  color:
                    error.includes("Retrying") || error.includes("Opening")
                      ? "#1976d2"
                      : "#c62828",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}

            {/* Opciones manuales colapsables */}
            {!showTokenInput ? (
              <details style={{ marginTop: 4 }}>
                <summary
                  style={{
                    fontSize: 12,
                    color: "#666",
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                >
                  Use Personal Access Token instead
                </summary>
                <button
                  onClick={() => setShowTokenInput(true)}
                  className="token-button"
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    background: "#f5f5f5",
                    color: "#333",
                  }}
                >
                  Enter Manual Token
                </button>
              </details>
            ) : (
              <div
                className="token-input-container"
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: "#f9f9f9",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0",
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                    To generate an OSF token:
                  </p>
                  <ol
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginLeft: 20,
                      marginBottom: 8,
                    }}
                  >
                    <li>
                      Go to{" "}
                      <a
                        href="https://osf.io/settings/tokens/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#3d92b4" }}
                      >
                        https://osf.io/settings/tokens/
                      </a>
                    </li>
                    <li>Click "Create Token"</li>
                    <li>
                      Select <strong>osf.full_write</strong> under scopes
                    </li>
                    <li>Click "Create token"</li>
                    <li>Copy the token and paste it below</li>
                  </ol>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#666",
                      marginBottom: 4,
                      marginTop: 12,
                    }}
                  >
                    OSF Parent Project ID:
                  </p>
                  <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                    Enter the ID of your OSF parent project. Each experiment
                    will create a data component (sub-project) inside this
                    project. You can find the ID in your project URL (e.g.,
                    https://osf.io/<strong>abc12</strong>)
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Parent Project ID (e.g., abc12)"
                  value={projectIdInput}
                  onChange={(e) => {
                    setProjectIdInput(e.target.value);
                    setError("");
                  }}
                  className="token-input"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 4,
                    border: error ? "1px solid #e57373" : "1px solid #ddd",
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                />
                <input
                  type="password"
                  placeholder="Paste your OSF token here"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setError("");
                  }}
                  className="token-input"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 4,
                    border: error ? "1px solid #e57373" : "1px solid #ddd",
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                />
                {error && (
                  <p
                    style={{ color: "#e57373", fontSize: 12, marginBottom: 8 }}
                  >
                    {error}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleSaveToken}
                    disabled={isSaving || !tokenInput.trim()}
                    className="token-button connect"
                    style={{ flex: 1 }}
                  >
                    {isSaving ? "Saving..." : "Save Token"}
                  </button>
                  <button
                    onClick={() => {
                      setShowTokenInput(false);
                      setTokenInput("");
                      setProjectIdInput("");
                      setError("");
                    }}
                    className="token-button"
                    style={{
                      flex: 1,
                      background: "#6c757d",
                      color: "white",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
