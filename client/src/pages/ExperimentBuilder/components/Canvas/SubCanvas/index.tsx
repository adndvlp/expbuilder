import "@xyflow/react/dist/style.css";
import { useState } from "react";
import ReactFlow from "reactflow";
import TrialNode from "../TrialNode";
import LoopNode from "../LoopNode";
import ResizeHandle from "../components/ResizeHandle";
import LoopBreadcrumb from "../components/LoopBreadcrumb";
import BranchedTrial from "../../ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import LoopRangeModal from "../../ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/LoopRangeModal";
import { Trial, Loop } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { useDraggable } from "../hooks/useDraggable";
import { useResizable } from "../hooks/useResizable";
import useTrials from "../../../hooks/useTrials";
import { TbBinaryTree } from "react-icons/tb";
import { FiRefreshCw } from "react-icons/fi";
import { getPatternStyle } from "../utils/styleUtils";
import Actions from "./Actions";
import GenerateNodesAndEdges from "./GenerateNodesAndEdges";

const nodeTypes = {
  trial: TrialNode,
  loop: LoopNode,
};

type SubCanvasProps = {
  loopId: string | number;
  loopName: string;
  loopTimeline: TimelineItem[];
  onClose: () => void;
  isDark: boolean;
  selectedTrial: Trial | null;
  selectedLoop: Loop | null;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: Loop) => void;
  onOpenNestedLoop?: (loopId: string | number) => void;
  onRefreshMetadata?: () => void; // Callback para recargar metadata desde Canvas
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

  const {
    createTrial,
    createLoop,
    getTrial,
    getLoop,
    updateTrial,
    updateLoop,
    timeline,
  } = useTrials();

  const [showBranchedModal, setShowBranchedModal] = useState(false);
  const [showLoopModal, setShowLoopModal] = useState(false);

  // Construir el breadcrumb completo (stack + loop actual)
  const fullBreadcrumb =
    loopId && !loopStack.some((l) => l.id === loopId)
      ? [...loopStack, { id: String(loopId), name: loopName }]
      : loopStack;

  const { onAddBranch, handleCreateNestedLoop, handleAddLoop, handleConnect } =
    Actions({
      onSelectTrial,
      onSelectLoop,
      onRefreshMetadata,
      getLoop,
      updateLoop,
      getTrial,
      updateTrial,
      loopTimeline,
      timeline,
      loopId,
      createTrial,
      setShowLoopModal,
      createLoop,
    });
  const { nodes, edges } = GenerateNodesAndEdges({
    onAddBranch,
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

  const patternStyle = getPatternStyle(isDark);

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
          }}
        >
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
        <div style={patternStyle} />

        {/* Create Loop button - show if there's more than one trial and either a trial or loop is selected */}
        {(() => {
          // Count total number of trials
          const totalTrialCount = loopTimeline.length;

          // Show button if there's more than one trial and either a trial or loop is selected
          const shouldShow =
            totalTrialCount > 1 && (selectedTrial || selectedLoop);

          return (
            shouldShow && (
              <button
                style={{
                  position: "absolute",
                  top: 16,
                  left: 16,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#1976d2",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                  zIndex: 10,
                }}
                title="Create Nested Loop"
                onClick={handleCreateNestedLoop}
              >
                <FiRefreshCw size={20} color="#fff" />
              </button>
            )
          );
        })()}

        {/* Branches button - show if there's more than one trial in the loop and a trial or loop is selected */}
        {(() => {
          // Count total number of trials
          const totalTrialCount = loopTimeline.length;

          // Show button if there's more than one trial and either a trial or loop is selected
          const shouldShow =
            totalTrialCount > 1 && (selectedTrial || selectedLoop);

          return (
            shouldShow && (
              <button
                style={{
                  position: "absolute",
                  top: 16,
                  left: shouldShow ? 64 : 16,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#4caf50",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                  zIndex: 10,
                }}
                title="Branches"
                onClick={() => setShowBranchedModal(true)}
              >
                <TbBinaryTree size={20} color="#fff" />
              </button>
            )
          );
        })()}

        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: 2 }}
          onConnect={handleConnect}
        />
        <ResizeHandle onMouseDown={handleResizeMouseDown} />
      </div>

      {showBranchedModal && (
        <BranchedTrial
          selectedTrial={selectedTrial}
          onClose={() => setShowBranchedModal(false)}
          isOpen={showBranchedModal}
        />
      )}

      {showLoopModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.32)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div style={{ position: "relative", zIndex: 10000 }}>
            <LoopRangeModal
              timeline={loopTimeline}
              onConfirm={handleAddLoop}
              onClose={() => setShowLoopModal(false)}
              selectedTrialId={selectedTrial?.id || selectedLoop?.id || null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default LoopSubCanvas;
