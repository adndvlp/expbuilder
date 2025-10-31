import { Handle, Position } from "reactflow";
import "./index.css";

interface TrialNodeData {
  name: string;
  selected: boolean;
  onClick: () => void;
  color?: string;
}

function TrialNode({ data }: { data: TrialNodeData }) {
  return (
    <div
      className={`trial-node${data.selected ? " trial-node--selected" : ""}`}
      onClick={data.onClick}
      style={data.color ? { background: data.color, color: "#fff" } : {}}
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
    </div>
  );
}

export default TrialNode;
