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
  const { trials, selectedTrial, selectedLoop } = useTrials();

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
      {trials.length > 1 && (
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
      {trials.length === 0 && (
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
          openLoop.trials.some((t: any) => t.id === selectedTrial.id);

        // Count total number of trials (including those in loops)
        const totalTrialCount = trials.reduce((count, item) => {
          if ("trials" in item) {
            // It's a loop, count its trials
            return count + item.trials.length;
          } else {
            // It's a trial
            return count + 1;
          }
        }, 0);

        // Show button if:
        // - There's more than one trial in the entire experiment, AND
        // - A trial or loop is selected
        const shouldShow =
          totalTrialCount > 1 &&
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
