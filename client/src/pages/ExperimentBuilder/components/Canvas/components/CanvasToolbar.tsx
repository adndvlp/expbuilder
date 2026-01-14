import React from "react";
import { FiRefreshCw } from "react-icons/fi";
import useTrials from "../../../hooks/useTrials";
import { TbBinaryTree } from "react-icons/tb";

type CanvasToolbarProps = {
  fabStyle: React.CSSProperties;
  onShowLoopModal: () => void;
  onAddTrial: () => void;
  openLoop: any;
  setShowBranchedModal: (value: boolean) => void;
};

function CanvasToolbar({
  fabStyle,
  onShowLoopModal,
  onAddTrial,
  openLoop,
  setShowBranchedModal,
}: CanvasToolbarProps) {
  const { timeline, selectedTrial, selectedLoop } = useTrials();

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
      {timeline.length > 1 && (
        <button
          style={{
            ...fabStyle,
            position: "static",
            width: 48,
            height: 48,
            fontSize: 24,
            background: "#1976d2",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
          onClick={onShowLoopModal}
          title="Add loop"
        >
          <FiRefreshCw size={24} color="#fff" />
        </button>
      )}
      {timeline.length === 0 && (
        <button
          style={{
            ...fabStyle,
            position: "static",
            width: 48,
            height: 48,
            fontSize: 28,
            background: "#ffb300",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
          onClick={onAddTrial}
          title="Add trial"
        >
          +
        </button>
      )}
      {(() => {
        // Check if selectedTrial is inside the openLoop
        const isTrialInsideOpenLoop =
          openLoop &&
          openLoop.trials &&
          selectedTrial &&
          openLoop.trials.includes(selectedTrial.id);

        // Show button if:
        // - There's more than one item in timeline, AND
        // - A trial or loop is selected
        const shouldShow =
          timeline.length > 1 &&
          ((selectedLoop && !isTrialInsideOpenLoop) ||
            (selectedTrial && !isTrialInsideOpenLoop));

        return (
          shouldShow && (
            <button
              style={{
                ...fabStyle,
                position: "static",
                width: 48,
                height: 48,
                fontSize: 28,
                background: "#4caf50",
                color: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
              title="Branches"
              onClick={() => setShowBranchedModal(true)}
            >
              <TbBinaryTree size={24} color="#fff" />
            </button>
          )
        );
      })()}
    </div>
  );
}

export default CanvasToolbar;
