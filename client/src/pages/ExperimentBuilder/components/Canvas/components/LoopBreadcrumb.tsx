import { FiHome, FiChevronRight } from "react-icons/fi";

interface LoopBreadcrumbItem {
  id: string;
  name: string;
}

interface LoopBreadcrumbProps {
  loopStack: LoopBreadcrumbItem[];
  onNavigate: (index: number) => void;
  onNavigateToRoot: () => void;
  compact?: boolean;
}

function LoopBreadcrumb({
  loopStack,
  onNavigate,
  onNavigateToRoot,
  compact = false,
}: LoopBreadcrumbProps) {
  const MAX_VISIBLE_LOOPS = 3; // Show a maximum of 3 loops before collapsing

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
        flexWrap: "nowrap" as const,
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

  // Determine which loops to show
  const shouldCollapse = loopStack.length > MAX_VISIBLE_LOOPS;
  const visibleLoops = shouldCollapse
    ? [
        loopStack[0], // First loop
        null, // Collapse indicator (...)
        ...loopStack.slice(-2), // Last 2 loops
      ]
    : loopStack;

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
      {visibleLoops.map((loop, displayIndex) => {
        // If null, show the ellipsis
        if (loop === null) {
          return (
            <div
              key="ellipsis"
              style={{
                display: "flex",
                alignItems: "center",
                gap: compact ? "4px" : "8px",
              }}
            >
              <FiChevronRight
                size={iconSize}
                color="rgba(255, 255, 255, 0.6)"
              />
              <span
                style={{
                  padding: buttonPadding,
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: fontSize,
                }}
              >
                ...
              </span>
            </div>
          );
        }

        // Calculate the real index in loopStack
        let realIndex: number;
        if (shouldCollapse) {
          if (displayIndex === 0) {
            realIndex = 0;
          } else {
            // displayIndex - 1 because we skip the null, then -2 from the end
            realIndex = loopStack.length - (visibleLoops.length - displayIndex);
          }
        } else {
          realIndex = displayIndex;
        }

        const isLast = realIndex === loopStack.length - 1;

        return (
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
              onClick={() => onNavigate(realIndex)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: buttonPadding,
                background: isLast ? "rgba(255, 255, 255, 0.2)" : "transparent",
                border: isLast
                  ? "1px solid rgba(255, 255, 255, 0.3)"
                  : "1px solid transparent",
                borderRadius: "4px",
                color: "#fff",
                cursor: "pointer",
                fontSize: fontSize,
                transition: "all 0.2s",
                whiteSpace: "nowrap" as const,
              }}
              onMouseEnter={(e) => {
                if (!isLast) {
                  e.currentTarget.style.background =
                    "rgba(255, 255, 255, 0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isLast) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {loop.name}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default LoopBreadcrumb;
