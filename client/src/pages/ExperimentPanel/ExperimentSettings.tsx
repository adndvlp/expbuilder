import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

type ExperimentSettingsProps = {
  experimentID: string | undefined;
};

type BatchConfig = {
  useIndexedDB: boolean;
  batchSize: number;
  resumeTimeoutMinutes: number;
};

function ExperimentSettings({ experimentID }: ExperimentSettingsProps) {
  const [config, setConfig] = useState<BatchConfig>({
    useIndexedDB: true,
    batchSize: 0,
    resumeTimeoutMinutes: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!experimentID) return;

    const loadConfig = async () => {
      try {
        const docRef = doc(db, "experiments", experimentID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig({
            useIndexedDB: data.batchConfig?.useIndexedDB ?? true,
            batchSize: data.batchConfig?.batchSize ?? 0,
            resumeTimeoutMinutes: data.batchConfig?.resumeTimeoutMinutes ?? 30,
          });
        }
      } catch (error) {
        console.error("Error loading configuration:", error);
        setMessage({ type: "error", text: "Error loading configuration" });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [experimentID]);

  const handleSave = async () => {
    if (!experimentID) return;

    setSaving(true);
    setMessage(null);

    try {
      const docRef = doc(db, "experiments", experimentID);
      await setDoc(
        docRef,
        {
          batchConfig: config,
        },
        { merge: true },
      );

      setMessage({
        type: "success",
        text: "Configuration saved successfully!",
      });
    } catch (error) {
      console.error("Error saving configuration:", error);
      setMessage({ type: "error", text: "Error saving configuration" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "var(--text-dark)" }}>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 32,
        backgroundColor: "var(--neutral-light)",
        borderRadius: 12,
        border: "1px solid var(--neutral-mid)",
      }}
    >
      <h2 style={{ color: "var(--text-dark)", marginBottom: 24, fontSize: 24 }}>
        Experiment Data Configuration
      </h2>

      {/* IndexedDB Setting */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="checkbox"
            id="useIndexedDB"
            checked={config.useIndexedDB}
            onChange={(e) =>
              setConfig({ ...config, useIndexedDB: e.target.checked })
            }
            style={{ width: 20, height: 20, cursor: "pointer" }}
          />
          <label
            htmlFor="useIndexedDB"
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "var(--text-dark)",
              cursor: "pointer",
            }}
          >
            Use IndexedDB (Client-side persistence)
          </label>
        </div>
        <p
          style={{
            marginLeft: 32,
            marginTop: 8,
            color: "var(--text-dark)",
            fontSize: 14,
            opacity: 0.8,
          }}
        >
          When enabled, trial data is stored in the participant's browser for
          offline resilience. Disable for maximum data confidentiality (trials
          sent directly to Firestore).
        </p>
      </div>

      {/* Batch Size Setting */}
      <div style={{ marginBottom: 32 }}>
        <label
          htmlFor="batchSize"
          style={{
            display: "block",
            fontSize: 16,
            fontWeight: "600",
            color: "var(--text-dark)",
            marginBottom: 8,
          }}
        >
          Batch Size
        </label>
        <input
          type="number"
          id="batchSize"
          min="0"
          value={config.batchSize}
          onChange={(e) =>
            setConfig({ ...config, batchSize: parseInt(e.target.value) || 0 })
          }
          style={{
            padding: 12,
            fontSize: 16,
            border: "2px solid var(--neutral-mid)",
            borderRadius: 6,
            width: "200px",
            backgroundColor: "var(--neutral-light)",
            color: "var(--text-dark)",
          }}
          disabled={!config.useIndexedDB}
        />
        <p
          style={{
            marginTop: 8,
            color: "var(--text-dark)",
            fontSize: 14,
            opacity: 0.8,
          }}
        >
          <strong>0</strong>: Send all trials at the end (no batching)
          <br />
          <strong>&gt; 0</strong>: Send trials in batches of N (e.g., 10 = batch
          every 10 trials)
          <br />
          {!config.useIndexedDB && (
            <em>(Only available with IndexedDB enabled)</em>
          )}
        </p>
      </div>

      {/* Resume Timeout Setting */}
      <div style={{ marginBottom: 32 }}>
        <label
          htmlFor="resumeTimeout"
          style={{
            display: "block",
            fontSize: 16,
            fontWeight: "600",
            color: "var(--text-dark)",
            marginBottom: 8,
          }}
        >
          Resume Timeout (minutes)
        </label>
        <input
          type="number"
          id="resumeTimeout"
          min="1"
          max="1440"
          value={config.resumeTimeoutMinutes}
          onChange={(e) =>
            setConfig({
              ...config,
              resumeTimeoutMinutes: parseInt(e.target.value) || 30,
            })
          }
          style={{
            padding: 12,
            fontSize: 16,
            border: "2px solid var(--neutral-mid)",
            borderRadius: 6,
            width: "200px",
            backgroundColor: "var(--neutral-light)",
            color: "var(--text-dark)",
          }}
        />
        <p
          style={{
            marginTop: 8,
            color: "var(--text-dark)",
            fontSize: 14,
            opacity: 0.8,
          }}
        >
          Time before disconnected session data is deleted (1-1440 minutes)
        </p>
      </div>

      {/* Storage Behavior Info */}
      <div
        style={{
          padding: 16,
          backgroundColor: "var(--primary-blue)",
          border: `4px solid var(--dark-blue)`,
          borderRadius: 6,
          marginBottom: 24,
          opacity: 0.9,
        }}
      >
        <h3
          style={{
            color: "var(--text-light)",
            marginBottom: 12,
            fontSize: 16,
            fontWeight: "bold",
          }}
        >
          Storage Behavior Summary
        </h3>
        <ul
          style={{
            color: "var(--text-light)",
            fontSize: 14,
            lineHeight: 1.8,
            paddingLeft: 20,
          }}
        >
          {config.useIndexedDB ? (
            <>
              <li>
                <strong>IndexedDB enabled:</strong> Trials cached locally
                {config.batchSize === 0
                  ? ", sent all at once when experiment completes"
                  : ` in batches of ${config.batchSize} trials`}
              </li>
              <li>
                Participants can reconnect within {config.resumeTimeoutMinutes}{" "}
                minutes
              </li>
            </>
          ) : (
            <>
              <li>
                <strong>IndexedDB disabled:</strong> Trials sent individually to
                Firestore
              </li>
              <li>
                <strong>Google Drive/Dropbox:</strong> Partial save on
                disconnect, append on completion
              </li>
              <li>
                <strong>OSF:</strong> Complete save only after timeout or
                completion (no PATCH support)
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Save Button */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="gradient-btn"
          style={{
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>

        {message && (
          <p
            style={{
              color: message.type === "success" ? "#4caf50" : "#f44336",
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

export default ExperimentSettings;
