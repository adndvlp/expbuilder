import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import ReactFlow, { Connection } from "reactflow";
import TrialNode from "./TrialNode";
import LoopNode from "./LoopNode";
import ResizeHandle from "./components/ResizeHandle";
import LoopBreadcrumb from "./components/LoopBreadcrumb";
import BranchedTrial from "../ConfigPanel/TrialsConfig/BranchedTrial";
import LoopRangeModal from "../ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import { Trial, Loop, TrialOrLoop } from "../ConfigPanel/types";
import { useDraggable } from "./hooks/useDraggable";
import { useResizable } from "./hooks/useResizable";
import { TbBinaryTree } from "react-icons/tb";
import { FiRefreshCw } from "react-icons/fi";
import { FiX } from "react-icons/fi";
import {
  findTrialById,
  generateUniqueName,
  validateConnection,
} from "./utils/trialUtils";
import {
  LAYOUT_CONSTANTS,
  calculateBranchWidth,
  createTrialNode,
  createLoopNode,
  createEdge,
} from "./utils/layoutUtils";
import { getPatternStyle } from "./utils/styleUtils";

const nodeTypes = {
  trial: TrialNode,
  loop: LoopNode,
};

interface LoopSubCanvasProps {
  trials: TrialOrLoop[];
  loopName: string;
  loopId?: string;
  onClose: () => void;
  isDark: boolean;
  selectedTrial: Trial | null;
  selectedLoop: Loop | null;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: Loop) => void;
  onOpenNestedLoop?: (loop: Loop) => void;
  loopStack?: Array<{ id: string; name: string }>;
  onNavigateToLoop?: (index: number) => void;
  onNavigateToRoot?: () => void;
  // Nueva prop para actualizar directamente toda la estructura
  allTrials?: any[];
  setAllTrials?: (trials: any[]) => void;
}

function LoopSubCanvas({
  trials,
  loopName,
  loopId,
  onClose,
  isDark,
  selectedTrial,
  selectedLoop,
  onSelectTrial,
  onSelectLoop,
  onOpenNestedLoop,
  loopStack = [],
  onNavigateToLoop,
  onNavigateToRoot,
  allTrials,
  setAllTrials,
}: LoopSubCanvasProps) {
  const { dragging, pos, handleMouseDown } = useDraggable({ x: 150, y: 250 });
  const { resizing, size, handleResizeMouseDown } = useResizable({
    width: 420,
    height: 320,
  });
  const [showBranchedModal, setShowBranchedModal] = useState(false);
  const [showLoopModal, setShowLoopModal] = useState(false);

  // Construir el breadcrumb completo (stack + loop actual)
  // Solo agregar el loop actual si no está ya en el stack
  const fullBreadcrumb =
    loopId && !loopStack.some((l) => l.id === loopId)
      ? [...loopStack, { id: loopId, name: loopName }]
      : loopStack;

  // Helper para navegar a través del loopStack y actualizar
  const updateInNestedStructure = (
    items: any[],
    stackIndex: number,
    updateFn: (items: any[]) => any[]
  ): any[] => {
    if (stackIndex >= loopStack.length) {
      // Ya llegamos al loop actual, aplicar la actualización
      return updateFn(items);
    }

    const targetLoopId = loopStack[stackIndex].id;
    return items.map((item: any) => {
      if ("trials" in item && item.id === targetLoopId) {
        return {
          ...item,
          trials: updateInNestedStructure(
            item.trials,
            stackIndex + 1,
            updateFn
          ),
        };
      }
      return item;
    });
  };

  // Funciones para actualizar la estructura
  const onAddBranch = (parentId: number | string, newBranchTrial: Trial) => {
    if (!allTrials || !setAllTrials) return;

    const addBranchInLoop = (loopTrials: any[]): any[] => {
      let found = false;
      const updatedTrials = loopTrials.map((item: any) => {
        if (item.id === parentId) {
          found = true;
          return {
            ...item,
            branches: [...(item.branches || []), newBranchTrial.id],
          };
        } else if ("trials" in item) {
          return {
            ...item,
            trials: addBranchInLoop(item.trials),
          };
        }
        return item;
      });

      // Solo agregar el trial si encontramos el parent en este nivel
      if (found) {
        return [...updatedTrials, newBranchTrial];
      }
      return updatedTrials;
    };

    const updatedTrials =
      loopStack.length > 0
        ? updateInNestedStructure(allTrials, 0, addBranchInLoop)
        : allTrials.map((item: any) => {
            if ("trials" in item && item.id === loopId) {
              return {
                ...item,
                trials: addBranchInLoop(item.trials),
              };
            }
            return item;
          });

    setAllTrials(updatedTrials);
  };

  const onUpdateTrial = (updatedTrial: Trial) => {
    if (!allTrials || !setAllTrials) return;

    const updateTrialInLoop = (loopTrials: any[]): any[] => {
      return loopTrials.map((item: any) => {
        if ("parameters" in item && item.id === updatedTrial.id) {
          return updatedTrial;
        } else if ("trials" in item) {
          return {
            ...item,
            trials: updateTrialInLoop(item.trials),
          };
        }
        return item;
      });
    };

    const updatedTrials =
      loopStack.length > 0
        ? updateInNestedStructure(allTrials, 0, updateTrialInLoop)
        : allTrials.map((item: any) => {
            if ("trials" in item && item.id === loopId) {
              return {
                ...item,
                trials: updateTrialInLoop(item.trials),
              };
            }
            return item;
          });

    setAllTrials(updatedTrials);
  };

  const onUpdateLoop = (updatedLoop: Loop) => {
    if (!allTrials || !setAllTrials) return;

    const updateLoopInLoop = (loopTrials: any[]): any[] => {
      return loopTrials.map((item: any) => {
        if ("trials" in item && item.id === updatedLoop.id) {
          return updatedLoop;
        } else if ("trials" in item) {
          return {
            ...item,
            trials: updateLoopInLoop(item.trials),
          };
        }
        return item;
      });
    };

    const updatedTrials =
      loopStack.length > 0
        ? updateInNestedStructure(allTrials, 0, updateLoopInLoop)
        : allTrials.map((item: any) => {
            if ("trials" in item && item.id === loopId) {
              return {
                ...item,
                trials: updateLoopInLoop(item.trials),
              };
            }
            return item;
          });

    setAllTrials(updatedTrials);
  };

  const onCreateNestedLoop = (itemIds: (number | string)[]) => {
    if (!allTrials || !setAllTrials) return;

    // Helper para obtener todos los nombres existentes recursivamente
    const getAllExistingNames = (items: any[]): string[] => {
      const names: string[] = [];
      items.forEach((item: any) => {
        if (item.name) names.push(item.name);
        if ("trials" in item && Array.isArray(item.trials)) {
          names.push(...getAllExistingNames(item.trials));
        }
      });
      return names;
    };

    // Helper para generar un nombre único
    const generateUniqueLoopName = (
      baseName: string,
      existingNames: string[]
    ): string => {
      let counter = 1;
      let name = baseName;
      while (existingNames.includes(name)) {
        counter++;
        name = `${baseName.replace(/ \d+$/, "")} ${counter}`;
      }
      return name;
    };

    const createLoopInLoop = (loopTrials: any[]): any[] => {
      const indices: number[] = [];
      itemIds.forEach((id) => {
        const idx = loopTrials.findIndex((t) => t.id == id);
        if (idx !== -1) indices.push(idx);
      });

      if (indices.length < 2) return loopTrials;

      const itemsToGroup = indices.map((i) => loopTrials[i]);

      // Obtener todos los nombres existentes en todo el experimento
      const existingNames = getAllExistingNames(allTrials);

      // Generar un nombre único basado en "Nested Loop"
      const uniqueName = generateUniqueLoopName("Nested Loop 1", existingNames);

      const newNestedLoop: Loop = {
        id: "loop_" + Date.now(),
        name: uniqueName,
        repetitions: 1,
        randomize: false,
        orders: false,
        stimuliOrders: [],
        orderColumns: [],
        categoryColumn: "",
        categories: false,
        categoryData: [],
        trials: itemsToGroup,
        code: "",
      };

      const newLoopTrials: any[] = [];
      const insertIndex = Math.min(...indices);

      for (let i = 0; i < loopTrials.length; i++) {
        if (i === insertIndex) {
          newLoopTrials.push(newNestedLoop);
        }
        if (!indices.includes(i)) {
          newLoopTrials.push(loopTrials[i]);
        }
      }

      return newLoopTrials;
    };

    // Construir el stack completo incluyendo el loop actual
    const fullStack =
      loopId && !loopStack.some((l) => l.id === loopId)
        ? [...loopStack, { id: loopId, name: loopName, trials: trials }]
        : loopStack;

    // Helper local que usa el fullStack
    const updateWithFullStack = (items: any[], stackIndex: number): any[] => {
      if (stackIndex >= fullStack.length) {
        // Ya llegamos al loop actual, aplicar la actualización
        return createLoopInLoop(items);
      }

      const targetLoopId = fullStack[stackIndex].id;
      return items.map((item: any) => {
        if ("trials" in item && item.id === targetLoopId) {
          return {
            ...item,
            trials: updateWithFullStack(item.trials, stackIndex + 1),
          };
        }
        return item;
      });
    };

    const updatedTrials =
      fullStack.length > 0
        ? updateWithFullStack(allTrials, 0)
        : allTrials.map((item: any) => {
            if ("trials" in item && item.id === loopId) {
              return {
                ...item,
                trials: createLoopInLoop(item.trials),
              };
            }
            return item;
          });

    setAllTrials(updatedTrials);
  };

  const { nodes, edges } = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const renderedItems = new Map<number | string, string>(); // Map item.id -> nodeId
    const { yStep, branchHorizontalSpacing, branchVerticalOffset } =
      LAYOUT_CONSTANTS;
    // Calculate the center X position based on the modal width
    const xTrial = size.width / 3.1;

    // Helper to check if item is Trial or Loop
    const isTrial = (item: TrialOrLoop): item is Trial => {
      return "parameters" in item;
    };

    // Collect all item IDs that are branches (recursively)
    const collectAllBranchIds = (
      itemsList: TrialOrLoop[]
    ): Set<number | string> => {
      const branchIds = new Set<number | string>();
      const processItem = (item: TrialOrLoop) => {
        if (item.branches && Array.isArray(item.branches)) {
          item.branches.forEach((branchId: number | string) => {
            branchIds.add(branchId);
            const branchItem = findTrialById(itemsList, branchId);
            if (branchItem) {
              processItem(branchItem);
            }
          });
        }
      };
      itemsList.forEach(processItem);
      return branchIds;
    };

    const branchItemIds = collectAllBranchIds(trials);
    const mainItems = trials.filter((item) => !branchItemIds.has(item.id));

    // Recursive function to render an item (trial or loop) and all its branches
    const renderItemWithBranches = (
      item: TrialOrLoop,
      parentId: string,
      x: number,
      y: number,
      depth: number = 0
    ): number => {
      const itemId = `${parentId}-${item.id}`;
      const isItemTrial = isTrial(item);
      const isSelectedTrial =
        isItemTrial && selectedTrial && selectedTrial.id === item.id;
      const isSelectedLoop =
        !isItemTrial && selectedLoop && selectedLoop.id === item.id;

      // Check if this item has already been rendered
      const existingNodeId = renderedItems.get(item.id);

      if (existingNodeId) {
        // Item already rendered, just create the edge without rendering again
        edges.push(createEdge(parentId, existingNodeId));
        return 0; // No depth added since we're not rendering
      }

      // Mark this item as rendered
      renderedItems.set(item.id, itemId);

      // Create edge from parent to this item
      edges.push(createEdge(parentId, itemId));

      const handleAddBranchForItem = () => {
        if (onAddBranch) {
          const existingNames = trials.map((t) => t.name);
          const newName = generateUniqueName(existingNames);

          const newBranchTrial: Trial = {
            id: Date.now(),
            type: "Trial",
            name: newName,
            parameters: {},
            trialCode: "",
          };

          onAddBranch(item.id, newBranchTrial);
        }
      };

      // Create node based on type
      if (isItemTrial) {
        nodes.push(
          createTrialNode(
            itemId,
            item.name,
            x,
            y,
            !!isSelectedTrial,
            () => onSelectTrial(item as Trial),
            isSelectedTrial ? handleAddBranchForItem : undefined
          )
        );
      } else {
        const loopItem = item as Loop;
        nodes.push(
          createLoopNode(
            itemId,
            item.name,
            x,
            y,
            !!isSelectedLoop,
            () => onSelectLoop(loopItem),
            isSelectedLoop ? handleAddBranchForItem : undefined,
            onOpenNestedLoop ? () => onOpenNestedLoop(loopItem) : undefined
          )
        );
      }

      let maxDepth = 0;

      if (
        item.branches &&
        Array.isArray(item.branches) &&
        item.branches.length > 0
      ) {
        const branchWidths = item.branches.map((branchId: number | string) =>
          calculateBranchWidth(branchId, trials, branchHorizontalSpacing)
        );
        const totalWidth = branchWidths.reduce(
          (sum: number, width: number) => sum + width,
          0
        );

        let currentX = x - totalWidth / 2;

        item.branches.forEach((branchId: number | string, index: number) => {
          const branchItem = findTrialById(trials, branchId);
          if (branchItem) {
            const branchWidth = branchWidths[index];
            const branchX = currentX + branchWidth / 2;
            const branchY = y + branchVerticalOffset;

            const branchDepth = renderItemWithBranches(
              branchItem,
              itemId,
              branchX,
              branchY,
              depth + 1
            );
            maxDepth = Math.max(maxDepth, branchDepth);

            currentX += branchWidth;
          }
        });
      }

      return maxDepth + 1;
    };

    // Render main sequence items and their branches
    let yPos = 60;
    mainItems.forEach((item) => {
      const isItemTrial = isTrial(item);
      const isSelectedTrial =
        isItemTrial && selectedTrial && selectedTrial.id === item.id;
      const isSelectedLoop =
        !isItemTrial && selectedLoop && selectedLoop.id === item.id;

      // Mark main sequence items as rendered
      renderedItems.set(item.id, String(item.id));

      const handleAddBranchForItem = () => {
        if (onAddBranch) {
          const existingNames = trials.map((t) => t.name);
          const newName = generateUniqueName(existingNames);

          const newBranchTrial: Trial = {
            id: Date.now(),
            type: "Trial",
            name: newName,
            parameters: {},
            trialCode: "",
          };

          onAddBranch(item.id, newBranchTrial);
        }
      };

      // Create node based on type
      if (isItemTrial) {
        nodes.push(
          createTrialNode(
            String(item.id),
            item.name,
            xTrial,
            yPos,
            !!isSelectedTrial,
            () => onSelectTrial(item as Trial),
            isSelectedTrial ? handleAddBranchForItem : undefined
          )
        );
      } else {
        const loopItem = item as Loop;
        nodes.push(
          createLoopNode(
            String(item.id),
            item.name,
            xTrial,
            yPos,
            !!isSelectedLoop,
            () => onSelectLoop(loopItem),
            isSelectedLoop ? handleAddBranchForItem : undefined,
            onOpenNestedLoop ? () => onOpenNestedLoop(loopItem) : undefined
          )
        );
      }

      // Render branches recursively and calculate max depth
      let maxBranchDepth = 0;
      if (
        item.branches &&
        Array.isArray(item.branches) &&
        item.branches.length > 0
      ) {
        const branchWidths = item.branches.map((branchId: number | string) =>
          calculateBranchWidth(branchId, trials, branchHorizontalSpacing)
        );
        const totalWidth = branchWidths.reduce(
          (sum: number, width: number) => sum + width,
          0
        );
        let currentX = xTrial - totalWidth / 2;

        item.branches.forEach((branchId: number | string, index: number) => {
          const branchItem = findTrialById(trials, branchId);
          if (branchItem) {
            const branchWidth = branchWidths[index];
            const branchX = currentX + branchWidth / 2;

            const branchDepth = renderItemWithBranches(
              branchItem,
              String(item.id),
              branchX,
              yPos + branchVerticalOffset,
              0
            );
            maxBranchDepth = Math.max(maxBranchDepth, branchDepth);

            currentX += branchWidth;
          }
        });
      }

      yPos += yStep + maxBranchDepth * branchVerticalOffset;
    });

    // Add edges between main sequence items (vertical connection)
    for (let i = 0; i < mainItems.length - 1; i++) {
      edges.push(
        createEdge(String(mainItems[i].id), String(mainItems[i + 1].id))
      );
    }

    return { nodes, edges };
  }, [
    trials,
    selectedTrial,
    selectedLoop,
    onSelectTrial,
    onSelectLoop,
    onAddBranch,
    onUpdateTrial,
    onUpdateLoop,
    onOpenNestedLoop,
    size.width,
  ]);

  // Handler for connecting trials manually within the loop
  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || !onUpdateTrial) return;

    // Extract the actual trial IDs from the node IDs
    const extractTrialId = (nodeId: string): number | null => {
      const segments = nodeId.split("-");
      const lastSegment = segments[segments.length - 1];
      const parsed = parseInt(lastSegment);
      return isNaN(parsed) ? null : parsed;
    };

    const sourceId = extractTrialId(connection.source);
    const targetId = extractTrialId(connection.target);

    if (sourceId === null || targetId === null) {
      console.error("Invalid connection IDs");
      return;
    }

    // Validate the connection
    const validation = validateConnection(sourceId, targetId, trials);
    if (!validation.isValid) {
      alert(validation.errorMessage || "Invalid connection");
      return;
    }

    // Find and update the source trial
    const sourceTrial = findTrialById(trials, sourceId);
    if (sourceTrial) {
      const branches = sourceTrial.branches || [];
      // Only add if not already present
      if (!branches.includes(targetId)) {
        const updatedTrial = {
          ...sourceTrial,
          branches: [...branches, targetId],
        };
        onUpdateTrial(updatedTrial);
      }
    }
  };

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

        {/* Branches button - show if there's more than one trial in the loop */}
        {trials.length > 1 && selectedTrial && (
          <button
            style={{
              position: "absolute",
              top: 16,
              right: 16,
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
        )}

        {/* ParamsOverride button removed - now integrated in BranchedTrial modal */}

        {/* Create Loop button - show if there are at least 2 items */}
        {trials.length >= 2 && (
          <button
            style={{
              position: "absolute",
              top: 16,
              right: selectedTrial ? 112 : 16,
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
            onClick={() => setShowLoopModal(true)}
          >
            <FiRefreshCw size={20} color="#fff" />
          </button>
        )}

        {showBranchedModal && (
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
              <button
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
                onClick={() => setShowBranchedModal(false)}
                title="Close"
              >
                <FiX />
              </button>
              <BranchedTrial
                selectedTrial={selectedTrial}
                onClose={() => setShowBranchedModal(false)}
              />
            </div>
          </div>
        )}

        {/* ParamsOverride modal removed - now integrated in BranchedTrial modal */}

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
                trials={trials}
                onConfirm={(itemIds) => {
                  if (onCreateNestedLoop) {
                    onCreateNestedLoop(itemIds);
                  }
                  setShowLoopModal(false);
                }}
                onClose={() => setShowLoopModal(false)}
                selectedTrialId={selectedTrial?.id || selectedLoop?.id || null}
              />
            </div>
          </div>
        )}

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
    </div>
  );
}

export default LoopSubCanvas;
