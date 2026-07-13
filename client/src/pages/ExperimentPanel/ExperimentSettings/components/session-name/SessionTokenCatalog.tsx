import type { SessionNameTokenType } from "../../types";
import {
  MAX_SESSION_TOKENS,
  SESSION_TOKEN_CATALOG,
} from "../../utils/sessionName";

export function SessionTokenCatalog({
  tokenCount,
  onAddToken,
}: {
  tokenCount: number;
  onAddToken: (type: SessionNameTokenType) => void;
}) {
  const maxed = tokenCount >= MAX_SESSION_TOKENS;
  return (
    <div style={{ marginBottom: 20 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-dark)",
          opacity: 0.55,
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Available Components
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SESSION_TOKEN_CATALOG.map((metadata) => (
          <button
            key={metadata.type}
            onClick={() => onAddToken(metadata.type)}
            disabled={maxed}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 20,
              border: `2px solid ${metadata.color}33`,
              backgroundColor: maxed
                ? "var(--neutral-medium)"
                : `${metadata.color}15`,
              color: maxed ? "var(--text-dark)" : metadata.color,
              opacity: maxed ? 0.4 : 1,
              fontSize: 13,
              fontWeight: 600,
              cursor: maxed ? "not-allowed" : "pointer",
            }}
          >
            + {metadata.label}
          </button>
        ))}
        {maxed && (
          <span
            style={{
              alignSelf: "center",
              fontSize: 12,
              color: "var(--text-dark)",
              opacity: 0.5,
            }}
          >
            Límite de {MAX_SESSION_TOKENS} componentes alcanzado
          </span>
        )}
      </div>
    </div>
  );
}
