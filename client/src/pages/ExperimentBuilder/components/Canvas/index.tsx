import "@xyflow/react/dist/style.css";
import { useEffect, useState } from "react";
import ReactFlow from "reactflow";
import useTrials from "../../hooks/useTrials";
import BranchedTrial from "../ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import LoopNode from "./LoopNode";
import SubCanvas from "./SubCanvas";
import TrialNode from "./TrialNode";
import CanvasModals from "./components/CanvasModals";
import CanvasToolbar from "./components/CanvasToolbar";
import { useCanvasBranchActions } from "./hooks/useCanvasBranchActions";
import { useCanvasLoopActions } from "./hooks/useCanvasLoopActions";
import { useCanvasMoveActions } from "./hooks/useCanvasMoveActions";
import { useFlowLayout } from "./hooks/useFlowLayout";
import {
  getCanvasBackground,
  getFabStyle,
  getIsDarkMode,
  getPatternStyle,
} from "./utils/styleUtils";

const nodeTypes = {
  trial: TrialNode,
  loop: LoopNode,
};

function Canvas() {
  const trials = useTrials();
  const {
    timeline,
    loopTimeline,
    selectedTrial,
    setSelectedTrial,
    selectedLoop,
    setSelectedLoop,
    getTrial,
    getLoop,
    getLoopTimeline,
  } = trials;
  const [loopStack, setLoopStack] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showBranchedModal, setShowBranchedModal] = useState(false);
  const loopActions = useCanvasLoopActions(trials);
  const branchActions = useCanvasBranchActions(trials);
  const moveActions = useCanvasMoveActions(trials);
  const {
    showLoopModal,
    setShowLoopModal,
    openLoop,
    setOpenLoop,
    onAddTrial,
    handleCreateLoop,
    handleAddLoop,
    handleOpenLoop,
    handleRefreshLoopMetadata,
  } = loopActions;
  const {
    showAddTrialModal,
    setShowAddTrialModal,
    pendingParentId,
    setPendingParentId,
    onAddBranch,
    handleAddTrialConfirm,
  } = branchActions;
  const {
    showMoveItemModal,
    setShowMoveItemModal,
    itemToMove,
    setItemToMove,
    onMoveItem,
    handleMoveItemConfirm,
  } = moveActions;

  useEffect(() => {
    if (showBranchedModal) {
      const item = selectedTrial || selectedLoop;
      if (item?.parentLoopId) {
        getLoopTimeline(item.parentLoopId);
      }
    }
  }, [
    showBranchedModal,
    selectedTrial?.parentLoopId,
    selectedLoop?.parentLoopId,
  ]);

  const { nodes, edges } = useFlowLayout({
    timeline,
    selectedTrial,
    selectedLoop,
    onSelectTrial: async (trial) => {
      try {
        const fullTrial = await getTrial(trial.id);
        if (fullTrial) setSelectedTrial(fullTrial);
      } catch (error) {
        console.error("Error fetching full trial data:", error);
      }
      setSelectedLoop(null);
    },
    onSelectLoop: async (loop) => {
      try {
        const fullLoop = await getLoop(loop.id);
        if (fullLoop) setSelectedLoop(fullLoop);
      } catch (error) {
        console.error("Error fetching full loop data:", error);
      }
      setSelectedTrial(null);
    },
    onAddBranch,
    onOpenLoop: handleOpenLoop,
  });

  const isDark = getIsDarkMode();
  const canvasBg = getCanvasBackground(isDark);
  const patternStyle = getPatternStyle(isDark);
  const fabStyle = getFabStyle(isDark);

  return (
    <div style={canvasBg}>
      <div style={patternStyle} />
      <div
        style={{
          width: "100%",
          height: "100vh",
          position: "relative",
          zIndex: 1,
        }}
      >
        <CanvasToolbar
          fabStyle={fabStyle}
          onShowLoopModal={handleCreateLoop}
          onAddTrial={() => onAddTrial("Trial")}
          openLoop={openLoop}
          setShowBranchedModal={setShowBranchedModal}
          onMoveItem={
            selectedTrial || selectedLoop
              ? () => onMoveItem((selectedTrial || selectedLoop)!.id)
              : undefined
          }
        />

        {showBranchedModal && (
          <BranchedTrial
            selectedTrial={selectedTrial || selectedLoop}
            onClose={() => setShowBranchedModal(false)}
            isOpen={showBranchedModal}
          />
        )}

        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: -100 }}
          onPaneClick={() => {
            setSelectedTrial(null);
            setSelectedLoop(null);
          }}
        />

        {openLoop && (
          <SubCanvas
            loopId={openLoop.id}
            loopName={openLoop.name}
            loopTimeline={loopTimeline}
            onRefreshMetadata={handleRefreshLoopMetadata}
            isDark={isDark}
            selectedTrial={selectedTrial}
            selectedLoop={selectedLoop}
            loopStack={loopStack}
            onNavigateToLoop={(index) => {
              if (index < loopStack.length) {
                const targetLoopId = loopStack[index].id;
                handleOpenLoop(targetLoopId);
                setLoopStack(loopStack.slice(0, index));
              }
            }}
            onNavigateToRoot={() => {
              setOpenLoop(null);
              setSelectedLoop(null);
              setLoopStack([]);
            }}
            onClose={() => {
              if (loopStack.length > 0) {
                const previousLoopId = loopStack[loopStack.length - 1].id;
                handleOpenLoop(previousLoopId);
                setLoopStack(loopStack.slice(0, -1));
              } else {
                setOpenLoop(null);
                setSelectedLoop(null);
              }
            }}
            onSelectTrial={(trial) => {
              setSelectedTrial(trial);
              setSelectedLoop(null);
            }}
            onSelectLoop={(loop) => {
              setSelectedLoop(loop);
              setSelectedTrial(null);
            }}
            onOpenNestedLoop={async (nestedLoopId) => {
              const isAlreadyInStack = loopStack.some(
                (loop) => loop.id === openLoop.id,
              );
              const newStack = isAlreadyInStack
                ? loopStack
                : [...loopStack, { id: openLoop.id, name: openLoop.name }];

              setLoopStack(newStack);
              await handleOpenLoop(String(nestedLoopId));
              const loopData = await getLoop(nestedLoopId);
              if (loopData) {
                setSelectedLoop(loopData);
                setSelectedTrial(null);
              }
            }}
          />
        )}

        <CanvasModals
          timeline={timeline}
          selectedItemId={selectedTrial?.id || selectedLoop?.id || null}
          showLoopModal={showLoopModal}
          onAddLoop={handleAddLoop}
          onCloseLoop={() => setShowLoopModal(false)}
          showAddTrialModal={showAddTrialModal}
          pendingParentId={pendingParentId}
          onAddTrial={handleAddTrialConfirm}
          onCloseAddTrial={() => {
            setShowAddTrialModal(false);
            setPendingParentId(null);
          }}
          showMoveItemModal={showMoveItemModal}
          itemToMove={itemToMove}
          onMoveItem={handleMoveItemConfirm}
          onCloseMoveItem={() => {
            setShowMoveItemModal(false);
            setItemToMove(null);
          }}
        />
      </div>
    </div>
  );
}

export default Canvas;
