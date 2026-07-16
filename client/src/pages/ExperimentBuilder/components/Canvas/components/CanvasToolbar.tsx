import type { CSSProperties } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { TbBinaryTree } from "react-icons/tb";

type CanvasToolbarProps = {
  fabStyle: CSSProperties;
  scopeKind: "root" | "loop";
  itemCount: number;
  hasSelection: boolean;
  onCreateLoop: () => void;
  onAddTrial: () => void;
  onShowBranches: () => void;
  onMoveItem?: () => void;
};

const actionStyle = (
  fabStyle: CSSProperties,
  background: string,
): CSSProperties => ({
  ...fabStyle,
  position: "static",
  width: 48,
  height: 48,
  fontSize: 24,
  background,
  color: "#fff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
});

function CanvasToolbar({
  fabStyle,
  scopeKind,
  itemCount,
  hasSelection,
  onCreateLoop,
  onAddTrial,
  onShowBranches,
  onMoveItem,
}: CanvasToolbarProps) {
  const isRoot = scopeKind === "root";
  const showCreateLoop = itemCount > 0 && (isRoot || hasSelection);
  const showItemActions =
    hasSelection && (isRoot ? itemCount > 1 : itemCount > 0);

  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 24,
        display: "flex",
        gap: 16,
        zIndex: 10,
      }}
    >
      {showCreateLoop && (
        <button
          type="button"
          style={actionStyle(fabStyle, "#1976d2")}
          onClick={onCreateLoop}
          title={isRoot ? "Add loop" : "Create Nested Loop"}
        >
          <FiRefreshCw size={24} color="#fff" />
        </button>
      )}
      {isRoot && itemCount === 0 && (
        <button
          type="button"
          style={actionStyle(fabStyle, "#ffb300")}
          onClick={onAddTrial}
          title="Add trial"
        >
          +
        </button>
      )}
      {showItemActions && (
        <button
          type="button"
          style={actionStyle(fabStyle, "#4caf50")}
          title="Branches"
          onClick={onShowBranches}
        >
          <TbBinaryTree size={24} color="#fff" />
        </button>
      )}
      {showItemActions && onMoveItem && (
        <button
          type="button"
          style={actionStyle(fabStyle, "#ff9800")}
          title="Move Item"
          onClick={onMoveItem}
        >
          ⇄
        </button>
      )}
    </div>
  );
}

export default CanvasToolbar;
