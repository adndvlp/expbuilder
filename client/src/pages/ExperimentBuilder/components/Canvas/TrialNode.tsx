import { Handle, Position } from "reactflow";
import "./index.css";

interface TrialNodeData {
  name: string;
  selected: boolean;
  onClick: () => void;
  onAddBranch?: () => void;
}

function TrialNode({ data }: { data: TrialNodeData }) {
  return (
    <div
      className={`trial-node${data.selected ? " trial-node--selected" : ""}`}
      onClick={data.onClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="react-flow__handle react-flow__handle-top"
      />
      {data.name}
      <Handle
        type="source"
        position={Position.Bottom}
        className="react-flow__handle react-flow__handle-bottom"
      />
      {/* Add branch button - only visible when trial is selected */}
      {data.selected && data.onAddBranch && (
        <button
          className="trial-node__add-branch-btn"
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

export default TrialNode;
