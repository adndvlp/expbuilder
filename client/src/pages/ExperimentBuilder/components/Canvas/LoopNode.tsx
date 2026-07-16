import "./index.css";
import { TbRepeat } from "react-icons/tb";
import CanvasNodeHandles from "./components/CanvasNodeHandles";

type LoopNodeData = {
  name: string;
  selected: boolean;
  expanded?: boolean;
  loading?: boolean;
  onClick: () => void;
  onAddBranch?: () => void;
  onOpenLoop?: () => void;
};

function LoopNode({ data }: { data: LoopNodeData }) {
  return (
    <div
      className={`loop-node${data.selected ? " loop-node--selected" : ""}`}
      onClick={data.onClick}
    >
      <CanvasNodeHandles />
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <TbRepeat size={16} />
        {data.name}
      </div>
      {/* Open loop button - always visible for loops */}
      {data.onOpenLoop && (
        <button
          className="loop-node__open-btn"
          type="button"
          aria-expanded={data.expanded ?? false}
          disabled={data.loading}
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenLoop?.();
          }}
          title={
            data.loading
              ? "Loading loop"
              : data.expanded
                ? "Collapse loop"
                : "Expand loop"
          }
        >
          {data.expanded ? "⤡" : "⤢"}
        </button>
      )}
      {/* Add branch button - only visible when loop is selected */}
      {data.selected && data.onAddBranch && (
        <button
          className="loop-node__add-branch-btn"
          onClick={(e) => {
            e.stopPropagation();
            data.onAddBranch?.();
          }}
          title="Add branch"
        >
          +
        </button>
      )}
    </div>
  );
}

export default LoopNode;
