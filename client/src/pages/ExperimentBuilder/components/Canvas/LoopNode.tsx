import { Handle, Position } from "reactflow";

interface LoopNodeData {
  name: string;
  selected: boolean;
  onClick: () => void;
}

function LoopNode({ data }: { data: LoopNodeData }) {
  return (
    <div
      className={`timeline-item timeline-loop ${data.selected ? "selected" : ""}`}
      style={{
        width: "180px",
        minWidth: "120px",
        borderRadius: "8px",
        padding: "12px",
        textAlign: "center",
        background: data.selected ? "#d4af37" : "#3d92b4",
        border: data.selected ? "2px solid #d4af37" : "1px solid #ccc",
        cursor: "pointer",
      }}
      onClick={data.onClick}
    >
      <strong>{data.name}</strong>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default LoopNode;
