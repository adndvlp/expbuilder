import type { WorkspaceDocument } from "../../../../../../../shared/experiment-workspace/dist/types.js";
import type { WorkspaceNode as Node, WorkspaceEdge as Edge } from "./types";
import { ReactFlow, ConnectionMode, SelectionMode } from "@xyflow/react";
import { workspaceClient } from "../../../modules/experiment-workspace/browserClient";
import BranchedTrial from "../../ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import { useWorkspaceController } from "./useWorkspaceController.js";
import WorkspaceNode from "./WorkspaceNode.tsx";
import WorkspaceEdge from "./WorkspaceEdge.tsx";
import LoopRoutingEdge from "../components/LoopRoutingEdge";
import CanvasToolbar from "../components/CanvasToolbar";
import CanvasViewportFitter from "../components/CanvasViewportFitter";
import AddTrialModal from "../components/AddTrialModal";
import LoopBranchLevelModal from "../features/loop-branching/LoopBranchLevelModal";
import {
  getCanvasBackground,
  getPatternStyle,
  getFabStyle,
} from "../utils/styleUtils";
import "./workspace.css";
const nodeTypes = { trial: WorkspaceNode, loop: WorkspaceNode },
  edgeTypes = { navigation: WorkspaceEdge, loop: LoopRoutingEdge };
export default function WorkspaceCanvas({
  document: doc,
}: {
  document: WorkspaceDocument;
}) {
  const {
    clearPane,
    experimentID,
    element,
    selection,
    busy,
    error,
    setError,
    branch,
    setBranch,
    selectedTrial,
    state,
    M,
    connection,
    shown,
    topology,
    bounds,
    engage,
    release,
    addLoose,
    createLoop,
    onDelete,
    travel,
    isDark,
    dragging,
    layout,
  } = useWorkspaceController(doc);
  const modal = connection.modal;
  const currentSelection = selection.selection;
  return (
    <div
      ref={element}
      className="canvas-workspace workspace-canvas"
      tabIndex={-1}
      style={getCanvasBackground(isDark)}
      onPointerDownCapture={() =>
        element.current?.focus({ preventScroll: true })
      }
    >
      <div style={getPatternStyle(isDark)} />
      <ReactFlow<Node, Edge>
        nodes={shown.nodes}
        edges={shown.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        {...selection.events}
        {...dragging.events}
        onPaneClick={clearPane}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={null}
        paneClickDistance={4}
        connectionMode={ConnectionMode.Loose}
        onConnect={connection.connect}
        isValidConnection={connection.valid}
        connectionRadius={24}
        nodesConnectable={!busy}
        nodesDraggable={!busy}
        edgesReconnectable={!busy}
        onReconnect={connection.reconnect}
        onConnectStart={engage}
        onConnectEnd={release}
        onReconnectStart={engage}
        onReconnectEnd={release}
        reconnectRadius={14}
        deleteKeyCode={null}
        minZoom={0.1}
        panOnDrag={[1]}
        panOnScroll
        zoomOnDoubleClick={false}
        zoomOnPinch
        zoomOnScroll={false}
        style={{ background: "transparent" }}
        proOptions={{ hideAttribution: true }}
      >
        <CanvasViewportFitter layoutSignature={topology} bounds={bounds} />
      </ReactFlow>
      <CanvasToolbar
        fabStyle={getFabStyle(isDark)}
        scopeKind="root"
        itemCount={doc.trials.length + doc.loops.length}
        hasSelection={!!selectedTrial}
        onCreateLoop={createLoop}
        onAddTrial={addLoose}
        onShowBranches={() => setBranch(true)}
      />
      <div className="workspace-history">
        <button
          title="Undo"
          disabled={busy || !workspaceClient.canUndo(experimentID)}
          onClick={() => travel(false)}
        >
          ↶
        </button>
        <button
          title="Redo"
          disabled={busy || !workspaceClient.canRedo(experimentID)}
          onClick={() => travel(true)}
        >
          ↷
        </button>
        {selection.selection && (
          <button
            onClick={onDelete}
            disabled={
              busy ||
              (currentSelection?.type === "edge" &&
                !layout.flowEdges.find(
                  (e) => e.data.selectionId === currentSelection.id,
                )?.data.editable)
            }
            title="Delete selection"
          >
            ⌫
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="workspace-error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {dragging.proposal && (
        <div className="insertion-preview" role="status">
          {dragging.proposal.mode === "parallel"
            ? "Insertar en paralelo"
            : "Insertar en secuencial"}
        </div>
      )}
      {modal && (
        <div
          className="workspace-modal"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {modal.type === "level" ? (
            <LoopBranchLevelModal
              sourceName={M.item(state, modal.parentId)?.name ?? ""}
              levels={modal.levels}
              isSubmitting={busy}
              onClose={() => connection.setModal(null)}
              onConfirm={connection.chooseLevel}
            />
          ) : (
            <AddTrialModal
              parentName={M.item(state, modal.parentId)?.name}
              existingTrialName={
                modal.connection
                  ? M.item(state, modal.connection.target)?.name
                  : undefined
              }
              onClose={() => connection.setModal(null)}
              onConfirm={(parallel) =>
                connection.submit(
                  modal,
                  modal.scopeId,
                  parallel ? "parallel" : "sequential",
                )
              }
            />
          )}
        </div>
      )}
      {branch && selectedTrial && (
        <BranchedTrial
          selectedTrial={selectedTrial}
          isOpen
          onClose={() => setBranch(false)}
        />
      )}
    </div>
  );
}
