import "./index.css";
import CanvasNodeHandles from "./components/CanvasNodeHandles";

type TrialNodeData = {
  name: string;
  selected: boolean;
  onClick: () => void;
  onAddBranch?: () => void;
};

function TrialNode({ data }: { data: TrialNodeData }) {
  return (
    <div
      className={`trial-node${data.selected ? " trial-node--selected" : ""}`}
      onClick={data.onClick}
    >
      <CanvasNodeHandles />
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
