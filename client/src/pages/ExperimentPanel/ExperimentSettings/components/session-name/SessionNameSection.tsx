import { useState } from "react";
import type {
  SessionNameToken,
  SessionNameTokenType,
  StatusMessage,
} from "../../types";
import { SessionFormula } from "./SessionFormula";
import { SeparatorSelector } from "./SeparatorSelector";
import { SessionTokenCatalog } from "./SessionTokenCatalog";
import { SessionTokenOptions } from "./SessionTokenOptions";

interface SessionNameSectionProps {
  tokens: SessionNameToken[];
  separator: string;
  preview: string;
  saving: boolean;
  message: StatusMessage | null;
  onAddToken: (type: SessionNameTokenType) => void;
  onRemoveToken: (id: string) => void;
  onReorderToken: (from: number, to: number) => void;
  onUpdateToken: (id: string, patch: Partial<SessionNameToken>) => void;
  onSeparatorChange: (separator: string) => void;
  onSave: () => void;
}

export function SessionNameSection(props: SessionNameSectionProps) {
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null);
  const expandedToken = props.tokens.find(
    (token) => token.id === expandedTokenId,
  );
  const missingUniqueToken =
    props.tokens.length > 0 &&
    !props.tokens.some(
      (token) => token.type === "randomAlpha" || token.type === "counter",
    );
  const removeToken = (id: string) => {
    props.onRemoveToken(id);
    if (expandedTokenId === id) setExpandedTokenId(null);
  };

  return (
    <div style={{ marginBottom: 32, marginTop: 8 }}>
      <h2 style={{ color: "var(--text-dark)", marginBottom: 8, fontSize: 24 }}>
        Session Name Configuration
      </h2>
      <p
        style={{
          color: "var(--text-dark)",
          fontSize: 14,
          opacity: 0.8,
          marginBottom: 20,
        }}
      >
        Define how session names are automatically composed for each participant
        run.
      </p>
      <SessionTokenCatalog
        tokenCount={props.tokens.length}
        onAddToken={props.onAddToken}
      />
      <SessionFormula
        tokens={props.tokens}
        separator={props.separator}
        expandedTokenId={expandedTokenId}
        onExpandedTokenChange={setExpandedTokenId}
        onRemoveToken={removeToken}
        onReorderToken={props.onReorderToken}
      />
      <SeparatorSelector
        separator={props.separator}
        onChange={props.onSeparatorChange}
      />
      {expandedToken && (
        <SessionTokenOptions
          token={expandedToken}
          onUpdate={(patch) => props.onUpdateToken(expandedToken.id, patch)}
        />
      )}
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-dark)",
          opacity: 0.55,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Preview
      </p>
      <div
        style={{
          padding: "10px 18px",
          backgroundColor: "#1a1a2e",
          borderRadius: 8,
          fontFamily: "monospace",
          fontSize: 15,
          color: props.preview ? "#a6e3a1" : "#6c7086",
          letterSpacing: "0.05em",
          display: "inline-block",
          minWidth: 260,
        }}
      >
        {props.preview || "add components to see a preview"}
      </div>
      {missingUniqueToken && (
        <div
          style={{
            padding: "10px 14px",
            marginTop: 12,
            backgroundColor: "#f39c1220",
            border: "1px solid #f39c12",
            borderRadius: 6,
            fontSize: 13,
            color: "#f39c12",
            fontWeight: 600,
          }}
        >
          Debes incluir al menos un componente <strong>Random ID</strong> o{" "}
          <strong>Participant Number</strong> para garantizar que cada sesión
          sea única.
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginTop: 16,
        }}
      >
        <button
          onClick={props.onSave}
          disabled={props.saving}
          className="gradient-btn"
          style={{
            opacity: props.saving ? 0.6 : 1,
            cursor: props.saving ? "not-allowed" : "pointer",
          }}
        >
          {props.saving ? "Saving..." : "Save Session Name"}
        </button>
        {props.message && (
          <p
            style={{
              color: props.message.type === "success" ? "#4caf50" : "#f44336",
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {props.message.text}
          </p>
        )}
      </div>
    </div>
  );
}
