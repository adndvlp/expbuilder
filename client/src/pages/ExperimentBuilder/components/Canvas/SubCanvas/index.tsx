import "@xyflow/react/dist/style.css";
import { useState } from "react";
import ReactFlow from "reactflow";
import useTrials from "../../../hooks/useTrials";
import { TimelineItem } from "../../../contexts/TrialsContext";
import BranchedTrial from "../../ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import { Loop, Trial } from "../../ConfigurationPanel/types";
import LoopNode from "../LoopNode";
import TrialNode from "../TrialNode";
import CanvasModals from "../components/CanvasModals";
import LoopBreadcrumb from "../components/LoopBreadcrumb";
import ResizeHandle from "../components/ResizeHandle";
import { useDraggable } from "../hooks/useDraggable";
import { useResizable } from "../hooks/useResizable";
import { getPatternStyle } from "../utils/styleUtils";
import Actions from "./Actions";
import GenerateNodesAndEdges from "./GenerateNodesAndEdges";
import SubCanvasToolbar from "./SubCanvasToolbar";
import { useSubCanvasBranchActions } from "./hooks/useSubCanvasBranchActions";
import { useSubCanvasMoveActions } from "./hooks/useSubCanvasMoveActions";

const nodeTypes = {
  trial: TrialNode,
  loop: LoopNode,
};

type SubCanvasProps = {
  loopId: string;
  loopName: string;
  loopTimeline: TimelineItem[];
  onClose: () => void;
  isDark: boolean;
  selectedTrial: Trial | null;
  selectedLoop: Loop | null;
  onSelectTrial: (trial: Trial | null) => void;
  onSelectLoop: (loop: Loop | null) => void;
  onOpenNestedLoop?: (loopId: string | number) => void;
  onRefreshMetadata?: () => void;
  loopStack?: Array<{ id: string; name: string }>;
  onNavigateToLoop?: (index: number) => void;
  onNavigateToRoot?: () => void;
};

function LoopSubCanvas({
  loopId,
  loopName,
  loopTimeline,
  onClose,
  isDark,
  selectedTrial,
  selectedLoop,
  onSelectTrial,
  onSelectLoop,
  onOpenNestedLoop,
  onRefreshMetadata,
  loopStack = [],
  onNavigateToLoop,
  onNavigateToRoot,
}: SubCanvasProps) {
  const { dragging, pos, handleMouseDown } = useDraggable({ x: 150, y: 250 });
  const { resizing, size, handleResizeMouseDown } = useResizable({
    width: 420,
    height: 320,
  });
  const trials = useTrials();
  const {
    createTrial,
    createLoop,
    getTrial,
    getLoop,
    updateTrial,
    updateTrialField,
    updateLoop,
    timeline,
  } = trials;
  const [showBranchedModal, setShowBranchedModal] = useState(false);
  const [showLoopModal, setShowLoopModal] = useState(false);

  const fullBreadcrumb =
    loopId && !loopStack.some((loop) => loop.id === loopId)
      ? [...loopStack, { id: String(loopId), name: loopName }]
      : loopStack;
  const {
    addTrialAsBranch,
    addTrialAsParent,
    handleCreateNestedLoop,
    handleAddLoop,
  } = Actions({
    onSelectTrial,
    onSelectLoop,
    onRefreshMetadata,
    getLoop,
    updateLoop,
    getTrial,
    updateTrial,
    updateTrialField,
    loopTimeline,
    timeline,
    loopId,
    createTrial,
    setShowLoopModal,
    createLoop,
  });
  const branchActions = useSubCanvasBranchActions({
    loopTimeline,
    addTrialAsBranch,
    addTrialAsParent,
    onRefreshMetadata,
  });
  const moveActions = useSubCanvasMoveActions({
    loopId,
    loopTimeline,
    onRefreshMetadata,
    trials,
  });
  const { handleAddBranchClick } = branchActions;
  const { nodes, edges } = GenerateNodesAndEdges({
    onAddBranch: handleAddBranchClick,
    getLoop,
    getTrial,
    selectedLoop,
    selectedTrial,
    loopTimeline,
    size,
    onSelectTrial,
    onSelectLoop,
    onOpenNestedLoop,
  });
  const subCanvasBg = {
    background: isDark
      ? "radial-gradient(circle at 50% 50%, #23272f 80%, #181a20 100%)"
      : "radial-gradient(circle at 50% 50%, #f7f8fa 80%, #e9ecf3 100%)",
  };

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 2000,
        width: size.width,
        minHeight: size.height,
        height: size.height,
        ...subCanvasBg,
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        border: "2px solid #3d92b4",
        overflow: "hidden",
        userSelect: dragging ? "none" : "auto",
        transition: resizing ? "none" : "width 0.1s, height 0.1s",
      }}
    >
      <div
        style={{
          background: "#3d92b4",
          color: "#fff",
          padding: "8px 16px",
          cursor: "grab",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          {fullBreadcrumb.length > 0 && onNavigateToLoop && onNavigateToRoot ? (
            <LoopBreadcrumb
              loopStack={fullBreadcrumb}
              onNavigate={onNavigateToLoop}
              onNavigateToRoot={onNavigateToRoot}
              compact={true}
            />
          ) : (
            <span>{loopName}</span>
          )}
        </div>
        <button
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 18,
            cursor: "pointer",
          }}
          onClick={onClose}
          title="Close"
        >
          ×
        </button>
      </div>

      <div
        style={{
          width: "100%",
          height: size.height - 40,
          position: "relative",
          ...subCanvasBg,
        }}
      >
        <div style={getPatternStyle(isDark)} />
        <SubCanvasToolbar
          loopTimelineLength={loopTimeline.length}
          selectedTrial={selectedTrial}
          selectedLoop={selectedLoop}
          onCreateNestedLoop={handleCreateNestedLoop}
          onShowBranches={() => setShowBranchedModal(true)}
          onMoveItem={moveActions.onMoveItem}
        />
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: 2 }}
          onPaneClick={() => {
            onSelectTrial(null);
            onSelectLoop(null);
          }}
        />
        <ResizeHandle onMouseDown={handleResizeMouseDown} />
      </div>

      {showBranchedModal && (
        <BranchedTrial
          selectedTrial={selectedTrial || selectedLoop}
          onClose={() => setShowBranchedModal(false)}
          isOpen={showBranchedModal}
        />
      )}
      <CanvasModals
        timeline={loopTimeline}
        selectedItemId={selectedTrial?.id ?? selectedLoop?.id ?? null}
        showLoopModal={showLoopModal}
        onAddLoop={handleAddLoop}
        onCloseLoop={() => setShowLoopModal(false)}
        showAddTrialModal={branchActions.showAddTrialModal}
        pendingParentId={branchActions.pendingParentId}
        onAddTrial={branchActions.handleAddTrialConfirm}
        onCloseAddTrial={() => {
          branchActions.setShowAddTrialModal(false);
          branchActions.setPendingParentId(null);
        }}
        showMoveItemModal={moveActions.showMoveItemModal}
        itemToMove={moveActions.itemToMove}
        onMoveItem={moveActions.handleMoveItemConfirm}
        onCloseMoveItem={() => {
          moveActions.setShowMoveItemModal(false);
          moveActions.setItemToMove(null);
        }}
      />
    </div>
  );
}

export default LoopSubCanvas;
