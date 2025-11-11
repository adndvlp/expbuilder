import { Handle, Position } from "reactflow";
import "./index.css";
import { TbRepeat } from "react-icons/tb";

interface LoopNodeData {
  name: string;
  selected: boolean;
  onClick: () => void;
  onAddBranch?: () => void;
  onOpenLoop?: () => void;
}

function LoopNode({ data }: { data: LoopNodeData }) {
  return (
    <div
      className={`loop-node${data.selected ? " loop-node--selected" : ""}`}
      onClick={data.onClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="react-flow__handle react-flow__handle-top"
      />
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <TbRepeat size={16} />
        {data.name}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="react-flow__handle react-flow__handle-bottom"
      />
      {/* Open loop button - always visible for loops */}
      {data.onOpenLoop && (
        <button
          className="loop-node__open-btn"
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenLoop?.();
          }}
          title="Open loop"
        >
          ⤢
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
