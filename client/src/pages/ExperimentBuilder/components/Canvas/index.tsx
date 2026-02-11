import "@xyflow/react/dist/style.css";
import { useState, useEffect } from "react";
import ReactFlow, { Connection } from "reactflow";
import useTrials from "../../hooks/useTrials";
import TrialNode from "./TrialNode";
import LoopNode from "./LoopNode";
import SubCanvas from "./SubCanvas";
import LoopRangeModal from "../ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/LoopRangeModal";
import BranchedTrial from "../ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import AddTrialModal from "./components/AddTrialModal";
import MoveItemModal from "./components/MoveItemModal";
import CanvasToolbar from "./components/CanvasToolbar";
import { useFlowLayout } from "./hooks/useFlowLayout";
import { generateUniqueName } from "./utils/trialUtils";
import {
  getIsDarkMode,
  getCanvasBackground,
  getPatternStyle,
  getFabStyle,
} from "./utils/styleUtils";

const nodeTypes = {
  trial: TrialNode,
  loop: LoopNode,
};

function Canvas() {
  const {
    timeline,
    loopTimeline,
    selectedTrial,
    setSelectedTrial,
    selectedLoop,
    setSelectedLoop,
    createTrial,
    createLoop,
    getTrial,
    getLoop,
    updateTrial,
    updateLoop,
    updateTimeline,
    getLoopTimeline,
  } = useTrials();

  const [showLoopModal, setShowLoopModal] = useState(false);
  const [openLoop, setOpenLoop] = useState<any>(null);
  const [loopStack, setLoopStack] = useState<
    Array<{ id: string; name: string }>
  >([]); // Stack for nested loops
  const [showBranchedModal, setShowBranchedModal] = useState(false);
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

  // Load loopTimeline when branched modal opens for trial inside loop
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

  const onAddTrial = async (type: string) => {
    // Generate unique name based on timeline
    const existingNames = timeline.map((item) => item.name);
    const newName = generateUniqueName(existingNames);

    try {
      const newTrial = await createTrial({
        type: type,
        name: newName,
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
      });

      // Optimistic UI: add the trial to the timeline manually
      updateTimeline([
        ...timeline,
        {
          id: newTrial.id,
          type: "trial",
          name: newTrial.name,
          branches: newTrial.branches || [],
        },
      ]);

      setSelectedTrial(newTrial);
      setSelectedLoop(null);
    } catch (error) {
      console.error("Error creating trial:", error);
    }
  };

  const handleCreateLoop = () => {
    const confirmed = window.confirm(
      "Are you sure you want to group these trials/loops into a loop?",
    );
    if (!confirmed) {
      return;
    }

    // Show modal to select range
    setShowLoopModal(true);
  };

  const handleAddLoop = async (itemIds: (number | string)[]) => {
    if (itemIds.length < 2) {
      alert("You must select at least 2 trials/loops to create a loop.");
      setShowLoopModal(false);
      return;
    }

    try {
      // Count existing loops to generate name
      const loopCount = timeline.filter((item) => item.type === "loop").length;
      const loopName = `Loop ${loopCount + 1}`;

      const newLoop = await createLoop({
        name: loopName,
        repetitions: 1,
        randomize: false,
        orders: false,
        stimuliOrders: [],
        orderColumns: [],
        categoryColumn: "",
        categories: false,
        categoryData: [],
        trials: itemIds, // Only IDs
        code: "",
      });

      setSelectedLoop(newLoop);
      setSelectedTrial(null);
      setShowLoopModal(false);
    } catch (error) {
      console.error("Error creating loop:", error);
      setShowLoopModal(false);
    }
  };

  // Load full loop and metadata when opened
  const handleOpenLoop = async (loopId: string) => {
    try {
      const loopData = await getLoop(loopId);
      await getLoopTimeline(loopId);

      if (loopData) {
        setOpenLoop(loopData);
      }
    } catch (error) {
      console.error("Error loading loop:", error);
    }
  };

  // Reload metadata of the open loop
  const handleRefreshLoopMetadata = async () => {
    if (!openLoop) return;
    try {
      await getLoopTimeline(openLoop.id);
    } catch (error) {
      console.error("Error refreshing loop metadata:", error);
    }
  };

  // Handler to show the add trial modal
  const onAddBranch = async (parentId: number | string) => {
    // Check if the parent has branches
    const parentItem = timeline.find((item) => item.id === parentId);
    if (!parentItem) return;

    const parentBranches = parentItem.branches || [];

    // If it has no branches, add directly as branch
    if (parentBranches.length === 0) {
      await addTrialAsBranch(parentId);
      return;
    }

    // If it has branches, show modal to ask
    setPendingParentId(parentId);
    setShowAddTrialModal(true);
  };

  // Add trial as branch (sibling)
  const addTrialAsBranch = async (parentId: number | string) => {
    const existingNames = timeline.map((item) => item.name);
    const newName = generateUniqueName(existingNames);

    try {
      // First get the parent
      const parentItem = timeline.find((item) => item.id === parentId);
      if (!parentItem) return;

      // Create the trial
      const newBranchTrial = await createTrial({
        type: "Trial",
        name: newName,
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
      });

      // Get updated parent
      const parent =
        parentItem.type === "trial"
          ? await getTrial(parentId)
          : await getLoop(parentId);

      if (!parent) return;

      // Update the parent with the new branch
      // updateTrial/updateLoop will do the full optimistic UI
      if (parentItem.type === "trial") {
        await updateTrial(
          parentId,
          {
            branches: [...(parent.branches || []), newBranchTrial.id],
          },
          newBranchTrial,
        );
      } else {
        await updateLoop(
          parentId,
          {
            branches: [...(parent.branches || []), newBranchTrial.id],
          },
          newBranchTrial,
        );
      }

      setSelectedTrial(newBranchTrial);
    } catch (error) {
      console.error("Error adding branch:", error);
    }
  };

  // Add trial as parent (of the existing branches)
  const addTrialAsParent = async (parentId: number | string) => {
    const existingNames = timeline.map((item) => item.name);
    const newName = generateUniqueName(existingNames);

    try {
      // Get the parent to access its branches
      const parentItem = timeline.find((item) => item.id === parentId);
      if (!parentItem) return;

      let parentBranches: (number | string)[] = [];

      if (parentItem.type === "trial") {
        const parentTrial = await getTrial(parentId);
        if (parentTrial) {
          parentBranches = parentTrial.branches || [];
        }
      } else {
        const parentLoop = await getLoop(parentId);
        if (parentLoop) {
          parentBranches = parentLoop.branches || [];
        }
      }

      // Create the new trial that will be the parent of the branches
      const newParentTrial = await createTrial({
        type: "Trial",
        name: newName,
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: parentBranches, // The new trial becomes the parent of the existing branches
      });

      // Update the original parent to point to the new trial instead of the branches
      if (parentItem.type === "trial") {
        await updateTrial(
          parentId,
          {
            branches: [newParentTrial.id], // Now only points to the new trial
          },
          newParentTrial,
        );
      } else {
        await updateLoop(
          parentId,
          {
            branches: [newParentTrial.id], // Now only points to the new trial
          },
          newParentTrial,
        );
      }

      setSelectedTrial(newParentTrial);
    } catch (error) {
      console.error("Error adding trial as parent:", error);
    }
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
  };

  // Handler to open the move modal
  const onMoveItem = async (itemId: number | string) => {
    const item = timeline.find((t) => t.id === itemId);
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
      const currentParent = timeline.find((item) =>
        item.branches?.includes(itemToMove.id),
      );

      if (currentParent) {
        // Get the branches of the item to move (its children)
        const itemToMoveData = timeline.find(
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
      const destinationItem = timeline.find(
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
      // The moved item should be positioned right after the destination
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
    } catch (error) {
      console.error("Error moving item:", error);
    } finally {
      setItemToMove(null);
    }
  };

  // Handler for connecting trials manually
  const handleConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Extract the actual trial IDs from the node IDs
    const extractTrialId = (nodeId: string): number | string | null => {
      if (nodeId.startsWith("loop-")) {
        return nodeId.substring(5);
      }
      const segments = nodeId.split("-");
      const lastSegment = segments[segments.length - 1];
      const parsed = parseInt(lastSegment);
      return isNaN(parsed) ? lastSegment : parsed;
    };

    const sourceId = extractTrialId(connection.source);
    const targetId = extractTrialId(connection.target);

    if (sourceId === null || targetId === null) {
      console.error("Invalid connection IDs");
      return;
    }

    try {
      // Find the source in timeline
      const sourceItem = timeline.find((item) => item.id === sourceId);
      if (!sourceItem) return;

      if (sourceItem.type === "trial") {
        const sourceTrial = await getTrial(sourceId);
        if (!sourceTrial) return;

        const branches = sourceTrial.branches || [];
        if (!branches.includes(targetId)) {
          await updateTrial(sourceId, {
            branches: [...branches, targetId],
          });
        }
      } else {
        const sourceLoop = await getLoop(sourceId);
        if (!sourceLoop) return;

        const branches = sourceLoop.branches || [];
        if (!branches.includes(targetId)) {
          await updateLoop(sourceId, {
            branches: [...branches, targetId],
          });
        }
      }
    } catch (error) {
      console.error("Error connecting items:", error);
    }
  };

  const { nodes, edges } = useFlowLayout({
    timeline,
    selectedTrial,
    selectedLoop,
    onSelectTrial: async (trial) => {
      try {
        const fullTrial = await getTrial(trial.id);
        if (fullTrial) {
          setSelectedTrial(fullTrial);
        }
      } catch (error) {
        console.error("Error fetching full trial data:", error);
      }
      setSelectedLoop(null);
    },
    onSelectLoop: async (loop) => {
      try {
        const fullLoop = await getLoop(loop.id);
        if (fullLoop) {
          setSelectedLoop(fullLoop);
          // Also fetch metadata for loop trials? handled by handleOpenLoop if needed
        }
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
          onConnect={handleConnect}
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
                (l) => l.id === openLoop.id,
              );

              const newStack = isAlreadyInStack
                ? loopStack
                : [
                    ...loopStack,
                    {
                      id: openLoop.id,
                      name: openLoop.name,
                    },
                  ];

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
                timeline={timeline}
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
                    ? timeline.find((item) => item.id === pendingParentId)?.name
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
            const currentParent = timeline.find((item) =>
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
                    availableDestinations={timeline
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
    </div>
  );
}

export default Canvas;
