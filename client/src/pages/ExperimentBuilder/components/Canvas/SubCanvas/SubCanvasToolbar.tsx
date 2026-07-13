import { FiRefreshCw } from "react-icons/fi";
import { TbBinaryTree } from "react-icons/tb";
import { Loop, Trial } from "../../ConfigurationPanel/types";

type Props = {
  loopTimelineLength: number;
  selectedTrial: Trial | null;
  selectedLoop: Loop | null;
  onCreateNestedLoop: () => void;
  onShowBranches: () => void;
  onMoveItem: (id: string | number) => void;
};

export default function SubCanvasToolbar({
  loopTimelineLength,
  selectedTrial,
  selectedLoop,
  onCreateNestedLoop,
  onShowBranches,
  onMoveItem,
}: Props) {
  const selectedItem = selectedTrial || selectedLoop;
  if (loopTimelineLength < 1 || !selectedItem) return null;

  const buttonStyle = (left: number, background: string) => ({
    position: "absolute" as const,
    top: 16,
    left,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background,
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
    zIndex: 10,
  });

  return (
    <>
      <button
        style={buttonStyle(16, "#1976d2")}
        title="Create Nested Loop"
        onClick={onCreateNestedLoop}
      >
        <FiRefreshCw size={20} color="#fff" />
      </button>
      <button
        style={buttonStyle(64, "#4caf50")}
        title="Branches"
        onClick={onShowBranches}
      >
        <TbBinaryTree size={20} color="#fff" />
      </button>
      <button
        style={buttonStyle(112, "#ff9800")}
        title="Move Trial/Loop"
        onClick={() => onMoveItem(selectedItem.id)}
      >
        ⇄
      </button>
    </>
  );
}
