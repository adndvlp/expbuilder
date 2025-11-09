import { Loop } from "../../ConfigPanel/types";
import { FiHome, FiChevronRight } from "react-icons/fi";

interface LoopBreadcrumbProps {
  loopStack: Loop[];
  onNavigate: (index: number) => void;
  onNavigateToRoot: () => void;
  compact?: boolean; // 🆕 Modo compacto para usar en headers
}

function LoopBreadcrumb({
  loopStack,
  onNavigate,
  onNavigateToRoot,
  compact = false,
}: LoopBreadcrumbProps) {
  const containerStyle = compact
    ? {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "500",
        flexWrap: "wrap" as const,
      }
    : {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 16px",
        background: "rgba(255, 255, 255, 0.05)",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "500",
        marginBottom: "16px",
        flexWrap: "wrap" as const,
      };

  const buttonPadding = compact ? "4px 8px" : "6px 12px";
  const fontSize = compact ? "12px" : "14px";
  const iconSize = compact ? 14 : 16;

  return (
    <div style={containerStyle}>
      {/* Root button */}
      <button
        onClick={onNavigateToRoot}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: buttonPadding,
          background:
            loopStack.length === 0 ? "rgba(255, 255, 255, 0.2)" : "transparent",
          border:
            loopStack.length === 0
              ? "1px solid rgba(255, 255, 255, 0.3)"
              : "1px solid transparent",
          borderRadius: "4px",
          color: "#fff",
          cursor: "pointer",
          fontSize: fontSize,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (loopStack.length > 0) {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          }
        }}
        onMouseLeave={(e) => {
          if (loopStack.length > 0) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <FiHome size={iconSize} />
        {!compact && <span>Root</span>}
      </button>

      {/* Loop path */}
      {loopStack.map((loop, index) => (
        <div
          key={loop.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: compact ? "4px" : "8px",
          }}
        >
          <FiChevronRight size={iconSize} color="rgba(255, 255, 255, 0.6)" />
          <button
            onClick={() => onNavigate(index)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: buttonPadding,
              background:
                index === loopStack.length - 1
                  ? "rgba(255, 255, 255, 0.2)"
                  : "transparent",
              border:
                index === loopStack.length - 1
                  ? "1px solid rgba(255, 255, 255, 0.3)"
                  : "1px solid transparent",
              borderRadius: "4px",
              color: "#fff",
              cursor: "pointer",
              fontSize: fontSize,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (index !== loopStack.length - 1) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              }
            }}
            onMouseLeave={(e) => {
              if (index !== loopStack.length - 1) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            {loop.name}
            {loop.depth !== undefined && !compact && (
              <span
                style={{
                  fontSize: "11px",
                  opacity: 0.6,
                  marginLeft: "4px",
                }}
              >
                (L{loop.depth})
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

export default LoopBreadcrumb;
