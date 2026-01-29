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
    updateLoop,
    timeline,
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

  // Construir el breadcrumb completo (stack + loop actual)
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
    loopTimeline,
    timeline,
    loopId,
    createTrial,
    setShowLoopModal,
    createLoop,
  });

  // Wrapper para onAddBranch que muestra el modal
  const handleAddBranchClick = async (parentId: number | string) => {
    // Verificar si el parent tiene branches
    const parentItem = loopTimeline.find((item) => item.id === parentId);
    if (!parentItem) return;

    const parentBranches = parentItem.branches || [];

    // Si no tiene branches, agregar directamente como branch
    if (parentBranches.length === 0) {
      await addTrialAsBranch(parentId);
      if (onRefreshMetadata) {
        onRefreshMetadata();
      }
      return;
    }

    // Si tiene branches, mostrar modal para preguntar
    setPendingParentId(parentId);
    setShowAddTrialModal(true);
  };

  // Handler cuando el usuario confirma en el modal
  const handleAddTrialConfirm = async (addAsBranch: boolean) => {
    if (!pendingParentId) return;

    setShowAddTrialModal(false);

    if (addAsBranch) {
      await addTrialAsBranch(pendingParentId);
    } else {
      await addTrialAsParent(pendingParentId);
    }

    setPendingParentId(null);

    // Refresh metadata si está disponible
    if (onRefreshMetadata) {
      onRefreshMetadata();
    }
  };

  // Handler para abrir el modal de mover
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

  // Handler para ejecutar el movimiento del item
  const handleMoveItemConfirm = async (
    destinationId: number | string,
    addAsBranch: boolean,
  ) => {
    if (!itemToMove) return;

    setShowMoveItemModal(false);

    try {
      // ========== PASO 1: REMOVER del parent actual (reconectar como DELETE) ==========
      const currentParent = loopTimeline.find((item) =>
        item.branches?.includes(itemToMove.id),
      );

      if (currentParent) {
        // Obtener las branches del item que vamos a mover (sus hijos)
        const itemToMoveData = loopTimeline.find(
          (item) => item.id === itemToMove.id,
        );
        const childrenBranches = itemToMoveData?.branches || [];

        // Remover el item de las branches del parent
        const updatedBranches = (currentParent.branches || []).filter(
          (branchId) => branchId !== itemToMove.id,
        );

        // RECONECTAR: Agregar TODOS los hijos del item a las branches del parent
        childrenBranches.forEach((childId) => {
          if (!updatedBranches.includes(childId)) {
            updatedBranches.push(childId);
          }
        });

        // Actualizar el parent
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

      // ========== PASO 2: AGREGAR al nuevo destino ==========
      const destinationItem = loopTimeline.find(
        (item) => item.id === destinationId,
      );
      if (!destinationItem) {
        console.error("Destination item not found");
        return;
      }

      if (addAsBranch) {
        // Modo BRANCH (paralelo): Limpiar branches del item y agregarlo al destino
        // Primero limpiar las branches del item movido
        if (itemToMove.type === "trial") {
          await updateTrial(itemToMove.id, {
            branches: [],
          });
        } else {
          await updateLoop(itemToMove.id, {
            branches: [],
          });
        }

        // Luego agregarlo a las branches del destino
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
        // Modo SEQUENTIAL (parent): El item movido toma las branches del destino,
        // y el destino apunta solo al item movido
        if (destinationItem.type === "trial") {
          const destTrial = await getTrial(destinationId);
          if (destTrial) {
            const destBranches = destTrial.branches || [];

            // Actualizar el item movido para que tenga las branches del destino
            if (itemToMove.type === "trial") {
              await updateTrial(itemToMove.id, {
                branches: destBranches,
              });
            } else {
              await updateLoop(itemToMove.id, {
                branches: destBranches,
              });
            }

            // Actualizar el destino para que apunte solo al item movido
            await updateTrial(destinationId, {
              branches: [itemToMove.id],
            });
          }
        } else {
          const destLoop = await getLoop(destinationId);
          if (destLoop) {
            const destBranches = destLoop.branches || [];

            // Actualizar el item movido para que tenga las branches del destino
            if (itemToMove.type === "trial") {
              await updateTrial(itemToMove.id, {
                branches: destBranches,
              });
            } else {
              await updateLoop(itemToMove.id, {
                branches: destBranches,
              });
            }

            // Actualizar el destino para que apunte solo al item movido
            await updateLoop(destinationId, {
              branches: [itemToMove.id],
            });
          }
        }
      }

      console.log(`✓ Moved ${itemToMove.name} to ${destinationItem.name}`);

      // Refresh metadata
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
          // Encontrar el parent actual del item
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
                      // No mostrar el item mismo
                      if (item.id === itemToMove.id) return false;

                      // No mostrar el parent actual a menos que tenga más de 1 branch
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
