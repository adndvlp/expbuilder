interface ManualTokenFormProps {
  token: string;
  projectId: string;
  error: string;
  isSaving: boolean;
  onTokenChange: (value: string) => void;
  onProjectIdChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ManualTokenForm({
  token,
  projectId,
  error,
  isSaving,
  onTokenChange,
  onProjectIdChange,
  onSave,
  onCancel,
}: ManualTokenFormProps) {
  return (
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
          Enter the ID of your OSF parent project. Each experiment will create a
          data component (sub-project) inside this project. You can find the ID
          in your project URL (e.g., https://osf.io/<strong>abc12</strong>)
        </p>
      </div>
      <input
        type="text"
        placeholder="Parent Project ID (e.g., abc12)"
        value={projectId}
        onChange={(event) => onProjectIdChange(event.target.value)}
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
        value={token}
        onChange={(event) => onTokenChange(event.target.value)}
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
        <p style={{ color: "#e57373", fontSize: 12, marginBottom: 8 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="token-button connect"
          style={{ flex: 1 }}
        >
          {isSaving ? "Saving..." : "Save Token"}
        </button>
        <button
          onClick={onCancel}
          className="token-button"
          style={{ flex: 1, background: "#6c757d", color: "white" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
