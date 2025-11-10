import { memo } from "react";
import { Handle, Position } from "reactflow";
import { FiRefreshCw, FiChevronRight } from "react-icons/fi";

interface LoopNodeData {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  depth?: number;
  itemCount?: number;
}

interface LoopNodeProps {
  data: LoopNodeData;
}

function LoopNode({ data }: LoopNodeProps) {
  const {
    label,
    isSelected,
    onClick,
    onDoubleClick,
    depth = 0,
    itemCount = 0,
  } = data;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        padding: "16px 20px",
        borderRadius: "12px",
        border: isSelected ? "3px solid #1976d2" : "2px solid #90caf9",
        background: isSelected
          ? "linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)"
          : "linear-gradient(135deg, #42a5f5 0%, #64b5f6 100%)",
        color: "#fff",
        cursor: "pointer",
        minWidth: "180px",
        boxShadow: isSelected
          ? "0 8px 24px rgba(25, 118, 210, 0.4)"
          : "0 4px 12px rgba(66, 165, 245, 0.3)",
        transition: "all 0.2s ease",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 16px rgba(66, 165, 245, 0.4)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow =
            "0 4px 12px rgba(66, 165, 245, 0.3)";
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "#1976d2",
          width: 12,
          height: 12,
          border: "2px solid #fff",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <FiRefreshCw size={20} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "600", fontSize: "15px" }}>{label}</div>
          <div
            style={{
              fontSize: "12px",
              opacity: 0.9,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "4px",
            }}
          >
            <span>
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            {depth !== undefined && depth > 0 && (
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              >
                Depth: {depth}
              </span>
            )}
          </div>
        </div>
        {onDoubleClick && (
          <FiChevronRight
            size={16}
            style={{ opacity: 0.8 }}
            title="Double-click to enter"
          />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#1976d2",
          width: 12,
          height: 12,
          border: "2px solid #fff",
        }}
      />
    </div>
  );
}

export default memo(LoopNode);
