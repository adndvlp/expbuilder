import { ManualTokenForm } from "./components/ManualTokenForm";
import { useOsfToken } from "./hooks/useOsfToken";

export default function OsfTokenView() {
  const state = useOsfToken();
  if (state.isLoading) {
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
        {state.hasToken ? (
          <span className="token-status connected" title="Valid OSF Token">
            ✓ Connected
            {state.osfUserName && ` (${state.osfUserName})`}
            {state.osfProjectId && (
              <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>
                | Project: {state.osfProjectId}
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
        {state.hasToken ? (
          <button
            onClick={state.handleDeleteToken}
            disabled={state.isDeleting}
            className="token-button disconnect"
          >
            {state.isDeleting ? "Disconnecting..." : "Disconnect"}
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
            <button
              onClick={() => state.handleConnectOAuth(0)}
              disabled={state.isConnecting}
              className="token-button connect"
              style={{
                background: "linear-gradient(90deg, #3d92b4 60%, #4fc3f7 100%)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {state.isConnecting
                ? "Connecting..."
                : "🔐 Connect with OSF OAuth"}
            </button>

            {state.error && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 4,
                  background:
                    state.error.includes("Retrying") ||
                    state.error.includes("Opening")
                      ? "#e3f2fd"
                      : "#ffebee",
                  color:
                    state.error.includes("Retrying") ||
                    state.error.includes("Opening")
                      ? "#1976d2"
                      : "#c62828",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {state.error}
              </div>
            )}

            {!state.showTokenInput ? (
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
                  onClick={() => state.setShowTokenInput(true)}
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
              <ManualTokenForm
                token={state.tokenInput}
                projectId={state.projectIdInput}
                error={state.error}
                isSaving={state.isSaving}
                onTokenChange={(value) => {
                  state.setTokenInput(value);
                  state.setError("");
                }}
                onProjectIdChange={(value) => {
                  state.setProjectIdInput(value);
                  state.setError("");
                }}
                onSave={state.handleSaveToken}
                onCancel={state.cancelManualToken}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
