import { useState, useEffect } from "react";

// Detectar si estamos en Electron
const isElectron = !!window.electron?.readFirebaseConfig;

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export default function FirebaseCredentials() {
  const [isEditing, setIsEditing] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<FirebaseConfig>({
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
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
      const customConfig = await window.electron!.readFirebaseConfig();
      if (customConfig) {
        setHasCustomConfig(true);
        setConfig(customConfig);
      }
    } catch (error) {
      console.error("Error loading Firebase config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isElectron) return;

    // Validar que todos los campos estén llenos
    if (
      !config.apiKey ||
      !config.authDomain ||
      !config.projectId ||
      !config.storageBucket ||
      !config.messagingSenderId ||
      !config.appId
    ) {
      alert("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      const result = await window.electron!.writeFirebaseConfig(config);
      if (result.success) {
        setHasCustomConfig(true);
        setIsEditing(false);
        alert(
          "Firebase credentials saved successfully! Please restart the app for changes to take effect."
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
    if (!isElectron) return;

    if (
      !confirm(
        "Are you sure you want to reset to default Firebase credentials? The app will need to be restarted."
      )
    ) {
      return;
    }

    try {
      const result = await window.electron!.deleteFirebaseConfig();
      if (result.success) {
        setHasCustomConfig(false);
        setConfig({
          apiKey: "",
          authDomain: "",
          projectId: "",
          storageBucket: "",
          messagingSenderId: "",
          appId: "",
        });
        setIsEditing(false);
        alert(
          "Firebase credentials reset to default! Please restart the app for changes to take effect."
        );
      } else {
        alert(
          "Error resetting credentials: " + (result.error || "Unknown error")
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert("Error resetting credentials: " + message);
    }
  };

  const handleInputChange = (field: keyof FirebaseConfig, value: string) => {
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
        Custom Firebase credentials are only available in the Electron app.
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
              ✓ Using custom Firebase credentials
            </span>
          ) : (
            <span>Using default Firebase credentials</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  background: "#3d92b4",
                  color: "white",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {hasCustomConfig ? "Edit" : "Set Custom Credentials"}
              </button>
              {hasCustomConfig && (
                <button
                  onClick={handleReset}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 6,
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Reset to Default
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  background: "#28a745",
                  color: "white",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
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
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 14,
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
            Enter your Firebase project credentials. You can find these in your
            Firebase Console → Project Settings → General → Your apps → SDK
            setup and configuration.
          </div>
          {[
            { label: "API Key", field: "apiKey" as keyof FirebaseConfig },
            {
              label: "Auth Domain",
              field: "authDomain" as keyof FirebaseConfig,
            },
            { label: "Project ID", field: "projectId" as keyof FirebaseConfig },
            {
              label: "Storage Bucket",
              field: "storageBucket" as keyof FirebaseConfig,
            },
            {
              label: "Messaging Sender ID",
              field: "messagingSenderId" as keyof FirebaseConfig,
            },
            { label: "App ID", field: "appId" as keyof FirebaseConfig },
          ].map(({ label, field }) => (
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
