import "./index.css";
import type { ReactNode } from "react";
import CanvasNodeHandles from "./components/CanvasNodeHandles";

type TrialNodeData = {
  name: string;
  selected: boolean;
  onClick: () => void;
  onAddBranch?: () => void;
};

function TrialNode({ data, children }: { data: TrialNodeData; children?: ReactNode }) {
  return (
    <div
      className={`trial-node${data.selected ? " trial-node--selected" : ""}`}
      onClick={data.onClick}
    >
      <CanvasNodeHandles />
      {children}
      {data.name}
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
