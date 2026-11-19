import type { Dispatch, SetStateAction } from "react";
import type { BatchConfig, StatusMessage } from "../types";

interface DataSettingsSectionProps {
  experimentExists: boolean;
  config: BatchConfig;
  setConfig: Dispatch<SetStateAction<BatchConfig>>;
  onSave?: () => void;
  saving?: boolean;
  message?: StatusMessage | null;
}

const fieldStyle = {
  padding: 12,
  fontSize: 16,
  border: "2px solid var(--neutral-mid)",
  borderRadius: 6,
  width: "200px",
  backgroundColor: "var(--neutral-light)",
  color: "var(--text-dark)",
} as const;

export function DataSettingsSection({
  experimentExists,
  config,
  setConfig,
  onSave,
  saving = false,
  message = null,
}: DataSettingsSectionProps) {
  if (!experimentExists) {
    return (
      <div
        style={{
          padding: 12,
          marginBottom: 24,
          backgroundColor: "var(--neutral-mid)",
          borderRadius: 6,
          fontSize: 14,
          color: "var(--text-dark)",
          opacity: 0.8,
        }}
      >
        Data configuration options are available after the experiment is
        published.
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="checkbox"
            id="useIndexedDB"
            checked={config.useIndexedDB}
            onChange={(event) =>
              setConfig({ ...config, useIndexedDB: event.target.checked })
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
          recovery after closing or reloading this page. When disabled, unsent
          responses remain only in memory until the server confirms receipt.
        </p>
      </div>

      {config.useIndexedDB && (
        <NumberSetting
          id="batchSize"
          label="Batch Size"
          min={0}
          value={config.batchSize}
          onChange={(value) => setConfig({ ...config, batchSize: value || 0 })}
        >
          <strong>0</strong>: Send all trials at the end (no batching)
          <br />
          <strong>&gt; 0</strong>: Send trials in batches of N (e.g., 10 = batch
          every 10 trials)
        </NumberSetting>
      )}

      <NumberSetting
        id="resumeTimeout"
        label="Resume Timeout (minutes)"
        min={1}
        max={1440}
        value={config.resumeTimeoutMinutes}
        onChange={(value) =>
          setConfig({ ...config, resumeTimeoutMinutes: value })
        }
      >
        Deadline for resuming after disconnection (1-1440 whole minutes). At the
        deadline, the session closes and saving the responses received by the
        server is requested. Storage may finish later if retries are needed.
      </NumberSetting>

      <div
        style={{
          padding: 16,
          backgroundColor: "var(--primary-blue)",
          border: "4px solid var(--dark-blue)",
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
                  ? ", sent when the experiment completes"
                  : ` in batches of ${config.batchSize} trials`}
              </li>
              {config.batchSize === 0 && <li>With batch 0, the timeout cannot save responses that have never reached the server. Return in this browser to recover pending responses.</li>}
            </>
          ) : (
            <>
              <li>
                <strong>IndexedDB disabled:</strong> Trials sent individually to
                Firestore
              </li>
            </>
          )}
          <li>The same resume deadline applies to every storage provider and both IndexedDB modes.</li>
          <li>Return before {config.resumeTimeoutMinutes} minutes to continue the same session. After expiry, earlier pending responses stay with that session; starting another participation requires your choice.</li>
          <li>Saved settings apply to new sessions without republishing. Existing sessions retain their original configuration.</li>
        </ul>
      </div>

      {onSave && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <button
            onClick={onSave}
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
      )}
    </>
  );
}

function NumberSetting({
  id,
  label,
  min,
  max,
  value,
  disabled,
  onChange,
  children,
}: {
  id: string;
  label: string;
  min: number;
  max?: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 16,
          fontWeight: "600",
          color: "var(--text-dark)",
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      <input
        type="number"
        id={id}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={fieldStyle}
        disabled={disabled}
      />
      <p
        style={{
          marginTop: 8,
          color: "var(--text-dark)",
          fontSize: 14,
          opacity: 0.8,
        }}
      >
        {children}
      </p>
    </div>
  );
}
