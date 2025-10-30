// TrialNode.tsx
import { Handle, Position } from "reactflow";

interface TrialNodeData {
  name: string;
  selected: boolean;
  onClick: () => void;
}

function TrialNode({ data }: { data: TrialNodeData }) {
  return (
    <div
      className={`timeline-item ${data.selected ? "selected" : ""}`}
      style={{
        width: "180px",
        minWidth: "120px",
        borderRadius: "8px",
        padding: "12px",
        textAlign: "center",
        background: data.selected ? "#d4af37" : "#3d92b4",
        border: data.selected ? "2px solid #d4af37" : "1px solid #ccc",
        cursor: "grab",
        position: "relative",
        marginBottom: "8px",
      }}
      onClick={data.onClick}
    >
      {data.name}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default TrialNode;
