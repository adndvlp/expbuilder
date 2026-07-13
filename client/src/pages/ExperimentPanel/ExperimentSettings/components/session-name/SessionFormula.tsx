import { Fragment, useState } from "react";
import type { SessionNameToken } from "../../types";
import { SESSION_TOKEN_CATALOG } from "../../utils/sessionName";

interface SessionFormulaProps {
  tokens: SessionNameToken[];
  separator: string;
  expandedTokenId: string | null;
  onExpandedTokenChange: (id: string | null) => void;
  onRemoveToken: (id: string) => void;
  onReorderToken: (from: number, to: number) => void;
}

export function SessionFormula({
  tokens,
  separator,
  expandedTokenId,
  onExpandedTokenChange,
  onRemoveToken,
  onReorderToken,
}: SessionFormulaProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  return (
    <div style={{ marginBottom: 16 }}>
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
        Name Formula
      </p>
      <div
        style={{
          minHeight: 60,
          padding: 12,
          border: "2px dashed var(--neutral-mid)",
          borderRadius: 8,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          backgroundColor: "var(--neutral-light)",
        }}
      >
        {tokens.length === 0 ? (
          <p
            style={{
              width: "100%",
              textAlign: "center",
              color: "var(--text-dark)",
              opacity: 0.35,
              fontSize: 14,
              margin: 0,
            }}
          >
            Add components above to build the session name
          </p>
        ) : (
          tokens.map((token, index) => {
            const metadata = SESSION_TOKEN_CATALOG.find(
              (item) => item.type === token.type,
            )!;
            const isDragging = dragIndex === index;
            const isOver = dragOverIndex === index;
            return (
              <Fragment key={token.id}>
                <div
                  draggable
                  onDragStart={(event) => {
                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnter={() => setDragOverIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) onReorderToken(dragIndex, index);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "5px 10px",
                    borderRadius: 20,
                    backgroundColor: `${metadata.color}18`,
                    border: `2px solid ${
                      isOver && !isDragging
                        ? metadata.color
                        : `${metadata.color}44`
                    }`,
                    color: metadata.color,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "grab",
                    opacity: isDragging ? 0.35 : 1,
                    transition: "opacity 0.15s, border-color 0.15s",
                  }}
                >
                  <span
                    onClick={() =>
                      onExpandedTokenChange(
                        expandedTokenId === token.id ? null : token.id,
                      )
                    }
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    {metadata.label}
                  </span>
                  <button
                    onClick={() =>
                      onExpandedTokenChange(
                        expandedTokenId === token.id ? null : token.id,
                      )
                    }
                    title="Options"
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: metadata.color,
                      opacity: expandedTokenId === token.id ? 1 : 0.6,
                      padding: "0 2px",
                      fontSize: 14,
                    }}
                  />
                  <button
                    onClick={() => onRemoveToken(token.id)}
                    title="Remove"
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: metadata.color,
                      opacity: 0.7,
                      padding: "0 2px",
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                {index < tokens.length - 1 && (
                  <span
                    style={{
                      color: "var(--text-dark)",
                      opacity: 0.45,
                      fontSize: 13,
                      fontFamily: "monospace",
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  >
                    {separator === "" ? "·" : separator}
                  </span>
                )}
              </Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
