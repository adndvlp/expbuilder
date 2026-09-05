import { useState, useEffect } from "react";

// Detectar si estamos en Electron
const isElectron = !!window.electron?.readOauthConfig;

const FIELDS: Array<{ label: string; field: keyof OAuthConfig }> = [
  { label: "GitHub Client ID", field: "githubClientId" },
  { label: "Dropbox Client ID", field: "dropboxClientId" },
  { label: "Google Drive Client ID", field: "googleDriveClientId" },
  { label: "OSF Client ID", field: "osfClientId" },
];

export default function OAuthCredentials() {
  const [isEditing, setIsEditing] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<OAuthConfig>({
    githubClientId: "",
    dropboxClientId: "",
    googleDriveClientId: "",
    osfClientId: "",
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    if (!isElectron) {
      setIsLoading(false);
      return;
    }

    try {
      const customConfig = await window.electron!.readOauthConfig();
      if (customConfig) {
        setHasCustomConfig(true);
        setConfig({ ...config, ...customConfig });
      }
    } catch (error) {
      console.error("Error loading OAuth config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (FIELDS.some(({ field }) => !config[field])) {
      alert("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      const result = await window.electron!.writeOauthConfig(config);
      if (result.success) {
        setHasCustomConfig(true);
        setIsEditing(false);
        alert(
          "OAuth credentials saved successfully! Please restart the app for changes to take effect.",
        );
      } else {
        alert("Error saving credentials: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert("Error saving credentials: " + message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Are you sure you want to remove your OAuth credentials? The app will need to be restarted.",
      )
    ) {
      return;
    }

    try {
      const result = await window.electron!.deleteOauthConfig();
      if (result.success) {
        setHasCustomConfig(false);
        setConfig({
          githubClientId: "",
          dropboxClientId: "",
          googleDriveClientId: "",
          osfClientId: "",
        });
        setIsEditing(false);
        alert(
          "OAuth credentials removed! Please restart the app for changes to take effect.",
        );
      } else {
        alert(
          "Error removing credentials: " + (result.error || "Unknown error"),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert("Error removing credentials: " + message);
    }
  };

  const handleInputChange = (field: keyof OAuthConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  if (!isElectron) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: 8,
          color: "#856404",
          fontSize: 14,
        }}
      >
        Custom OAuth credentials are only available in the Electron app.
      </div>
    );
  }

  if (isLoading) {
    return <div style={{ padding: "12px 0" }}>Loading...</div>;
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, color: "#666" }}>
          {hasCustomConfig ? (
            <span style={{ color: "#28a745", fontWeight: 600 }}>
              ✓ Using custom OAuth credentials
            </span>
          ) : (
            <span>No custom OAuth credentials configured</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="token-button connect"
              >
                {hasCustomConfig ? "Edit" : "Set Credentials"}
              </button>
              {hasCustomConfig && (
                <button
                  onClick={handleReset}
                  className="token-button disconnect"
                >
                  Remove
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="token-button"
                style={{
                  background: "#28a745",
                  color: "white",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  loadConfig();
                }}
                disabled={isSaving}
                className="token-button"
                style={{
                  background: "#6c757d",
                  color: "white",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div
          style={{
            background: "#f8f9fa",
            padding: 16,
            borderRadius: 8,
            border: "1px solid #dee2e6",
          }}
        >
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            Enter the Client IDs of the OAuth apps you registered with each
            provider. The app connects to your server using these IDs.
          </div>
          {FIELDS.map(({ label, field }) => (
            <div key={field} style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: "#333",
                }}
              >
                {label}
              </label>
              <input
                type="text"
                value={config[field]}
                onChange={(e) => handleInputChange(field, e.target.value)}
                placeholder={`Enter ${label.toLowerCase()}`}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ced4da",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
