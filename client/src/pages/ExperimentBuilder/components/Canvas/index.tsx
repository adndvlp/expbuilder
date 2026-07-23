import "reactflow/dist/style.css";
import ReactFlow from "reactflow";
import BranchedTrial from "../ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import LoopNode from "./LoopNode";
import TrialNode from "./TrialNode";
import CanvasModals from "./components/CanvasModals";
import CanvasToolbar from "./components/CanvasToolbar";
import CanvasViewportFitter from "./components/CanvasViewportFitter";
import LoopRoutingEdge from "./components/LoopRoutingEdge";
import { useCanvasWorkspace } from "./hooks/useCanvasWorkspace";
import { getCanvasLayoutSignature } from "./services/getCanvasLayoutSignature";
import {
  getCanvasBackground,
  getFabStyle,
  getIsDarkMode,
  getPatternStyle,
} from "./utils/styleUtils";

const nodeTypes = { trial: TrialNode, loop: LoopNode };
const edgeTypes = { loop: LoopRoutingEdge };

function Canvas() {
  const workspace = useCanvasWorkspace();
  const {
    nodes,
    edges,
    expanded,
    actionScope,
    selectedItem,
    hasSelection,
    loopActions,
    branchActions,
    moveActions,
  } = workspace;
  const isDark = getIsDarkMode();
  const selectedItemId = selectedItem?.id ?? null;
  const layoutSignature = getCanvasLayoutSignature(nodes, edges);

  return (
    <div style={getCanvasBackground(isDark)}>
      <div style={getPatternStyle(isDark)} />
      <div className="canvas-workspace">
        <CanvasToolbar
          fabStyle={getFabStyle(isDark)}
          scopeKind={actionScope.kind}
          itemCount={actionScope.items.length}
          hasSelection={hasSelection}
          onCreateLoop={loopActions.handleCreateLoop}
          onAddTrial={() => void loopActions.onAddTrial("Trial")}
          onShowBranches={() => workspace.setShowBranchedModal(true)}
          onMoveItem={
            hasSelection && selectedItem
              ? () => moveActions.onMoveItem(selectedItem.id)
              : undefined
          }
        />

        {workspace.showBranchedModal && selectedItem && (
          <BranchedTrial
            selectedTrial={selectedItem}
            onClose={() => workspace.setShowBranchedModal(false)}
            isOpen
          />
        )}

        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.15 }}
          minZoom={0.1}
          nodesConnectable={false}
          style={{ background: "transparent" }}
          onPaneClick={workspace.clearSelection}
        >
          <CanvasViewportFitter layoutSignature={layoutSignature} />
        </ReactFlow>

        <div className="canvas-status" aria-live="polite">
          {expanded.isLoading ? "Loading loop…" : ""}
          {expanded.error ? "Unable to load the selected loop." : ""}
        </div>

        <CanvasModals
          timeline={actionScope.items}
          selectedItemId={selectedItemId}
          showLoopModal={loopActions.showLoopModal}
          onAddLoop={loopActions.handleAddLoop}
          onCloseLoop={() => loopActions.setShowLoopModal(false)}
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
    </div>
  );
}

export default Canvas;
