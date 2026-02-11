import "@xyflow/react/dist/style.css";
import { useState } from "react";
import ReactFlow from "reactflow";
import TrialNode from "../TrialNode";
import LoopNode from "../LoopNode";
import ResizeHandle from "../components/ResizeHandle";
import LoopBreadcrumb from "../components/LoopBreadcrumb";
import BranchedTrial from "../../ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import LoopRangeModal from "../../ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/LoopRangeModal";
import AddTrialModal from "../components/AddTrialModal";
import MoveItemModal from "../components/MoveItemModal";
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

  const {
    createTrial,
    createLoop,
    getTrial,
    getLoop,
    updateTrial,
    updateTrialField,
    updateLoop,
    timeline,
    updateTimeline,
  } = useTrials();

  const [showBranchedModal, setShowBranchedModal] = useState(false);
  const [showLoopModal, setShowLoopModal] = useState(false);
  const [showAddTrialModal, setShowAddTrialModal] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<
    number | string | null
  >(null);
  const [showMoveItemModal, setShowMoveItemModal] = useState(false);
  const [itemToMove, setItemToMove] = useState<{
    id: number | string;
    name: string;
    type: "trial" | "loop";
  } | null>(null);

  // Build the full breadcrumb (stack + current loop)
  const fullBreadcrumb =
    loopId && !loopStack.some((l) => l.id === loopId)
      ? [...loopStack, { id: String(loopId), name: loopName }]
      : loopStack;

  const {
    addTrialAsBranch,
    addTrialAsParent,
    handleCreateNestedLoop,
    handleAddLoop,
    handleConnect,
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

  // Wrapper for onAddBranch that shows the modal
  const handleAddBranchClick = async (parentId: number | string) => {
    // Check if the parent has branches
    const parentItem = loopTimeline.find((item) => item.id === parentId);
    if (!parentItem) return;

    const parentBranches = parentItem.branches || [];

    // If it has no branches, add directly as branch
    if (parentBranches.length === 0) {
      await addTrialAsBranch(parentId);
      if (onRefreshMetadata) {
        onRefreshMetadata();
      }
      return;
    }

    // If it has branches, show modal to ask
    setPendingParentId(parentId);
    setShowAddTrialModal(true);
  };

  // Handler when the user confirms in the modal
  const handleAddTrialConfirm = async (addAsBranch: boolean) => {
    if (!pendingParentId) return;

    setShowAddTrialModal(false);

    if (addAsBranch) {
      await addTrialAsBranch(pendingParentId);
    } else {
      await addTrialAsParent(pendingParentId);
    }

    setPendingParentId(null);

    // Refresh metadata if available
    if (onRefreshMetadata) {
      onRefreshMetadata();
    }
  };

  // Handler to open the move modal
  const onMoveItem = async (itemId: number | string) => {
    const item = loopTimeline.find((t) => t.id === itemId);
    if (!item) return;

    setItemToMove({
      id: item.id,
      name: item.name,
      type: item.type,
    });
    setShowMoveItemModal(true);
  };

  // Handler to execute the item move
  const handleMoveItemConfirm = async (
    destinationId: number | string,
    addAsBranch: boolean,
  ) => {
    if (!itemToMove) return;

    setShowMoveItemModal(false);

    try {
      // ========== STEP 1: REMOVE from current parent (reconnect as DELETE) ==========
      const currentParent = loopTimeline.find((item) =>
        item.branches?.includes(itemToMove.id),
      );

      if (currentParent) {
        // Get the branches of the item to move (its children)
        const itemToMoveData = loopTimeline.find(
          (item) => item.id === itemToMove.id,
        );
        const childrenBranches = itemToMoveData?.branches || [];

        // Remove the item from the parent's branches
        const updatedBranches = (currentParent.branches || []).filter(
          (branchId) => branchId !== itemToMove.id,
        );

        // RECONNECT: Add ALL children of the item to the parent's branches
        childrenBranches.forEach((childId) => {
          if (!updatedBranches.includes(childId)) {
            updatedBranches.push(childId);
          }
        });

        // Update the parent
        if (currentParent.type === "trial") {
          await updateTrial(currentParent.id, {
            branches: updatedBranches,
          });
        } else {
          await updateLoop(currentParent.id, {
            branches: updatedBranches,
          });
        }
      }

      // ========== STEP 2: ADD to the new destination ==========
      const destinationItem = loopTimeline.find(
        (item) => item.id === destinationId,
      );
      if (!destinationItem) {
        console.error("Destination item not found");
        return;
      }

      if (addAsBranch) {
        // BRANCH mode (parallel): Clear branches of the item and add it to the destination
        // First clear the branches of the moved item
        if (itemToMove.type === "trial") {
          await updateTrial(itemToMove.id, {
            branches: [],
          });
        } else {
          await updateLoop(itemToMove.id, {
            branches: [],
          });
        }

        // Then add it to the destination's branches
        if (destinationItem.type === "trial") {
          const destTrial = await getTrial(destinationId);
          if (destTrial) {
            await updateTrial(destinationId, {
              branches: [...(destTrial.branches || []), itemToMove.id],
            });
          }
        } else {
          const destLoop = await getLoop(destinationId);
          if (destLoop) {
            await updateLoop(destinationId, {
              branches: [...(destLoop.branches || []), itemToMove.id],
            });
          }
        }
      } else {
        // SEQUENTIAL mode (parent): The moved item takes the destination's branches,
        // and the destination points only to the moved item
        if (destinationItem.type === "trial") {
          const destTrial = await getTrial(destinationId);
          if (destTrial) {
            const destBranches = destTrial.branches || [];

            // Update the moved item to have the destination's branches
            if (itemToMove.type === "trial") {
              await updateTrial(itemToMove.id, {
                branches: destBranches,
              });
            } else {
              await updateLoop(itemToMove.id, {
                branches: destBranches,
              });
            }

            // Update the destination to point only to the moved item
            await updateTrial(destinationId, {
              branches: [itemToMove.id],
            });
          }
        } else {
          const destLoop = await getLoop(destinationId);
          if (destLoop) {
            const destBranches = destLoop.branches || [];

            // Update the moved item to have the destination's branches
            if (itemToMove.type === "trial") {
              await updateTrial(itemToMove.id, {
                branches: destBranches,
              });
            } else {
              await updateLoop(itemToMove.id, {
                branches: destBranches,
              });
            }

            // Update the destination to point only to the moved item
            await updateLoop(destinationId, {
              branches: [itemToMove.id],
            });
          }
        }
      }

      console.log(`✓ Moved ${itemToMove.name} to ${destinationItem.name}`);

      // ========== STEP 3: REORDER TIMELINE ==========
      // Items in a loop are also in the main timeline, so we need to reorder there too
      const newTimeline = [...timeline];

      // Remove the moved item from its current position
      const movedItemIndex = newTimeline.findIndex(
        (item) => item.id === itemToMove.id,
      );
      if (movedItemIndex !== -1) {
        newTimeline.splice(movedItemIndex, 1);
      }

      // Find the destination's position (after removal)
      const destIndex = newTimeline.findIndex(
        (item) => item.id === destinationId,
      );

      // Insert the moved item right after the destination
      if (destIndex !== -1) {
        newTimeline.splice(destIndex + 1, 0, {
          id: itemToMove.id,
          type: itemToMove.type,
          name: itemToMove.name,
          branches: [], // Will be updated by the backend
        });
      } else {
        // If destination not found, append at the end
        newTimeline.push({
          id: itemToMove.id,
          type: itemToMove.type,
          name: itemToMove.name,
          branches: [],
        });
      }

      // Update the timeline in the backend
      await updateTimeline(newTimeline);
      console.log("✓ Timeline reordered");

      // Refresh metadata to update the loop SubCanvas view
      if (onRefreshMetadata) {
        onRefreshMetadata();
      }
    } catch (error) {
      console.error("Error moving item:", error);
    } finally {
      setItemToMove(null);
    }
  };
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

        {/* Toolbar buttons - show if there's more than one trial and either a trial or loop is selected */}
        {(() => {
          // Count total number of trials
          const totalTrialCount = loopTimeline.length;

          // Show button if there's more than one trial and either a trial or loop is selected
          const shouldShow =
            totalTrialCount > 1 && (selectedTrial || selectedLoop);

          return (
            shouldShow && (
              <>
                {/* Create Nested Loop button */}
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

                {/* Branches button */}
                <button
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 64,
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

                {/* Move button */}
                <button
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 112,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#ff9800",
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
                  title="Move Trial/Loop"
                  onClick={() => {
                    const item = selectedTrial || selectedLoop;
                    if (item) {
                      onMoveItem(item.id);
                    }
                  }}
                >
                  ⇄
                </button>
              </>
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

      {showAddTrialModal && (
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
            <AddTrialModal
              onConfirm={handleAddTrialConfirm}
              onClose={() => {
                setShowAddTrialModal(false);
                setPendingParentId(null);
              }}
              parentName={
                pendingParentId
                  ? loopTimeline.find((item) => item.id === pendingParentId)
                      ?.name
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {showMoveItemModal &&
        itemToMove &&
        (() => {
          // Find the current parent of the item
          const currentParent = loopTimeline.find((item) =>
            item.branches?.includes(itemToMove.id),
          );

          return (
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
                <MoveItemModal
                  onConfirm={handleMoveItemConfirm}
                  onClose={() => {
                    setShowMoveItemModal(false);
                    setItemToMove(null);
                  }}
                  itemName={itemToMove.name}
                  availableDestinations={loopTimeline
                    .filter((item) => {
                      // Do not show the item itself
                      if (item.id === itemToMove.id) return false;

                      // Do not show the current parent unless it has more than 1 branch
                      if (currentParent && item.id === currentParent.id) {
                        const parentBranchCount =
                          currentParent.branches?.length || 0;
                        return parentBranchCount > 1;
                      }

                      return true;
                    })
                    .map((item) => ({
                      id: item.id,
                      name: item.name,
                      type: item.type,
                      hasBranches: (item.branches?.length || 0) > 0,
                    }))}
                />
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export default LoopSubCanvas;
