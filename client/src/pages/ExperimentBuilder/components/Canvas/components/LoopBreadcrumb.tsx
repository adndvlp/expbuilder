import { Loop } from "../../ConfigPanel/types";
import { FiHome, FiChevronRight } from "react-icons/fi";

interface LoopBreadcrumbProps {
  loopStack: Loop[];
  onNavigate: (index: number) => void;
  onNavigateToRoot: () => void;
}

function LoopBreadcrumb({
  loopStack,
  onNavigate,
  onNavigateToRoot,
}: LoopBreadcrumbProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 16px",
        background: "rgba(255, 255, 255, 0.05)",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "500",
        marginBottom: "16px",
        flexWrap: "wrap",
      }}
    >
      {/* Root button */}
      <button
        onClick={onNavigateToRoot}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px 12px",
          background:
            loopStack.length === 0 ? "rgba(25, 118, 210, 0.2)" : "transparent",
          border:
            loopStack.length === 0
              ? "1px solid rgba(25, 118, 210, 0.5)"
              : "1px solid transparent",
          borderRadius: "6px",
          color: loopStack.length === 0 ? "#1976d2" : "inherit",
          cursor: "pointer",
          fontSize: "14px",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (loopStack.length > 0) {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          }
        }}
        onMouseLeave={(e) => {
          if (loopStack.length > 0) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <FiHome size={16} />
        <span>Root</span>
      </button>

      {/* Loop path */}
      {loopStack.map((loop, index) => (
        <div
          key={loop.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FiChevronRight size={16} color="#666" />
          <button
            onClick={() => onNavigate(index)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 12px",
              background:
                index === loopStack.length - 1
                  ? "rgba(25, 118, 210, 0.2)"
                  : "transparent",
              border:
                index === loopStack.length - 1
                  ? "1px solid rgba(25, 118, 210, 0.5)"
                  : "1px solid transparent",
              borderRadius: "6px",
              color: index === loopStack.length - 1 ? "#1976d2" : "inherit",
              cursor: "pointer",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (index !== loopStack.length - 1) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              }
            }}
            onMouseLeave={(e) => {
              if (index !== loopStack.length - 1) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            {loop.name}
            {loop.depth !== undefined && (
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
