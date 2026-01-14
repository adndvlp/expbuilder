import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import ReactFlow, { Connection } from "reactflow";
import TrialNode from "./TrialNode";
import LoopNode from "./LoopNode";
import ResizeHandle from "./components/ResizeHandle";
import LoopBreadcrumb from "./components/LoopBreadcrumb";
import BranchedTrial from "../ConfigPanel/TrialsConfig/BranchedTrial";
import LoopRangeModal from "../ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import { Trial, Loop } from "../ConfigPanel/types";
import { TimelineItem } from "../../contexts/TrialsContext";
import { useDraggable } from "./hooks/useDraggable";
import { useResizable } from "./hooks/useResizable";
import useTrials from "../../hooks/useTrials";
import { TbBinaryTree } from "react-icons/tb";
import { FiRefreshCw } from "react-icons/fi";
import { FiX } from "react-icons/fi";
import { generateUniqueName } from "./utils/trialUtils";
import {
  LAYOUT_CONSTANTS,
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
  loopId: string | number;
  loopName: string;
  trialsMetadata: TimelineItem[];
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
}

function LoopSubCanvas({
  loopId,
  loopName,
  trialsMetadata,
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
}: LoopSubCanvasProps) {
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

  // Handler para agregar branch
  const onAddBranch = async (parentId: number | string) => {
    // Obtener TODOS los nombres existentes: del timeline principal + del loop actual
    const timelineNames = timeline.map((item) => item.name);
    const loopTrialNames = trialsMetadata.map((item) => item.name);
    const allNames = [...new Set([...timelineNames, ...loopTrialNames])];
    const newName = generateUniqueName(allNames);

    try {
      // Crear el trial branch con parentLoopId para que no se agregue al timeline principal
      const newBranchTrial = await createTrial({
        type: "Trial",
        name: newName,
        parameters: {},
        trialCode: "",
        parentLoopId: loopId, // Importante: establece que este trial está dentro del loop
      });

      // Actualizar el parent (trial o loop) para incluir este branch
      const parentItem = trialsMetadata.find((item) => item.id === parentId);
      if (!parentItem) return;

      if (parentItem.type === "trial") {
        const parentTrial = await getTrial(parentId);
        if (parentTrial) {
          await updateTrial(parentId, {
            branches: [...(parentTrial.branches || []), newBranchTrial.id],
          });
        }
      } else {
        const parentLoop = await getLoop(parentId);
        if (parentLoop) {
          await updateLoop(parentId, {
            branches: [...(parentLoop.branches || []), newBranchTrial.id],
          });
        }
      }

      onSelectTrial(newBranchTrial);
      if (onRefreshMetadata) onRefreshMetadata();
    } catch (error) {
      console.error("Error adding branch:", error);
    }
  };

  // Handler para crear loop anidado
  const handleCreateNestedLoop = () => {
    const confirmed = window.confirm(
      "Are you sure you want to group these trials/loops into a nested loop?"
    );
    if (!confirmed) {
      return;
    }

    setShowLoopModal(true);
  };

  const handleAddLoop = async (itemIds: (number | string)[]) => {
    if (itemIds.length < 2) {
      alert("You must select at least 2 trials/loops to create a loop.");
      setShowLoopModal(false);
      return;
    }

    try {
      // Obtener el loop padre completo para contar loops anidados
      const parentLoop = await getLoop(loopId);
      if (!parentLoop) return;

      // Obtener TODOS los nombres existentes: del timeline principal + del loop actual
      const timelineNames = timeline.map((item) => item.name);
      const loopTrialNames = trialsMetadata.map((item) => item.name);
      const allNames = [...new Set([...timelineNames, ...loopTrialNames])];
      const loopName = generateUniqueName(allNames, "Nested Loop 1");

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
        trials: itemIds,
        code: "",
        parentLoopId: loopId, // Importante: establece que este loop está dentro del loop padre
      });

      // Actualizar el loop padre para incluir el nuevo loop anidado
      const updatedTrials = [
        ...(parentLoop.trials || []).filter((id) => !itemIds.includes(id)),
        newLoop.id,
      ];

      await updateLoop(loopId, {
        trials: updatedTrials,
      });

      onSelectLoop(newLoop);
      setShowLoopModal(false);
      if (onRefreshMetadata) onRefreshMetadata();
    } catch (error) {
      console.error("Error creating nested loop:", error);
      setShowLoopModal(false);
    }
  };

  // Handler para conectar trials manualmente
  const handleConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Extraer IDs de los nodos
    const extractId = (nodeId: string): number | string | null => {
      if (nodeId.startsWith("loop-")) {
        return nodeId.substring(5);
      }
      const segments = nodeId.split("-");
      const lastSegment = segments[segments.length - 1];
      const parsed = parseInt(lastSegment);
      return isNaN(parsed) ? lastSegment : parsed;
    };

    const sourceId = extractId(connection.source);
    const targetId = extractId(connection.target);

    if (sourceId === null || targetId === null) {
      console.error("Invalid connection IDs");
      return;
    }

    try {
      // Buscar el source en trialsMetadata
      const sourceItem = trialsMetadata.find((item) => item.id === sourceId);
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

      if (onRefreshMetadata) onRefreshMetadata();
    } catch (error) {
      console.error("Error connecting items:", error);
    }
  };

  // Generar nodes y edges basándose en trialsMetadata
  const { nodes, edges } = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const renderedItems = new Map<number | string, string>();
    const { yStep, branchHorizontalSpacing, branchVerticalOffset } =
      LAYOUT_CONSTANTS;

    const xTrial = size.width / 3.1;

    // Recopilar todos los IDs de branches (recursivamente)
    const collectAllBranchIds = (
      items: TimelineItem[]
    ): Set<number | string> => {
      const branchIds = new Set<number | string>();

      const collectBranches = (item: TimelineItem) => {
        if (item.branches && item.branches.length > 0) {
          item.branches.forEach((branchId) => {
            branchIds.add(branchId);
            const branchItem = items.find((i) => i.id === branchId);
            if (branchItem) {
              collectBranches(branchItem);
            }
          });
        }
      };

      items.forEach(collectBranches);
      return branchIds;
    };

    const branchItemIds = collectAllBranchIds(trialsMetadata);
    const mainItems = trialsMetadata.filter(
      (item) => !branchItemIds.has(item.id)
    );

    // Función recursiva para renderizar un item y sus branches
    const renderItemWithBranches = (
      item: TimelineItem,
      parentId: string,
      x: number,
      y: number,
      depth: number = 0
    ): number => {
      const isTrial = item.type === "trial";
      const nodeId = isTrial ? `trial-${item.id}` : `loop-${item.id}`;

      if (renderedItems.has(item.id)) {
        const existingNodeId = renderedItems.get(item.id)!;
        if (parentId !== "root") {
          edges.push(createEdge(parentId, existingNodeId));
        }
        return y;
      }

      renderedItems.set(item.id, nodeId);

      // Crear nodo
      const isSelected = isTrial
        ? selectedTrial?.id === item.id
        : selectedLoop?.id === item.id;

      const handleSelect = async () => {
        if (isTrial) {
          const trial = await getTrial(item.id);
          if (trial) onSelectTrial(trial);
        } else {
          const loop = await getLoop(item.id);
          if (loop) onSelectLoop(loop);
        }
      };

      if (isTrial) {
        nodes.push(
          createTrialNode(
            nodeId,
            item.name,
            x,
            y,
            isSelected,
            handleSelect,
            isSelected ? () => onAddBranch(item.id) : undefined
          )
        );
      } else {
        nodes.push(
          createLoopNode(
            nodeId,
            item.name,
            x,
            y,
            isSelected,
            handleSelect,
            isSelected ? () => onAddBranch(item.id) : undefined,
            onOpenNestedLoop ? () => onOpenNestedLoop(item.id) : undefined
          )
        );
      }

      if (parentId !== "root") {
        edges.push(createEdge(parentId, nodeId));
      }

      let maxY = y;

      // Renderizar branches
      if (item.branches && item.branches.length > 0) {
        const branches = item.branches
          .map((branchId) => trialsMetadata.find((i) => i.id === branchId))
          .filter((b): b is TimelineItem => b !== undefined);

        if (branches.length > 0) {
          const startX =
            x -
            (branches.length * branchHorizontalSpacing) / 2 +
            branchHorizontalSpacing / 2;

          branches.forEach((branch, index) => {
            const branchX = startX + index * branchHorizontalSpacing;
            const branchY = y + branchVerticalOffset;

            const finalY = renderItemWithBranches(
              branch,
              nodeId,
              branchX,
              branchY,
              depth + 1
            );
            maxY = Math.max(maxY, finalY);
          });
        }
      }

      return maxY;
    };

    // Renderizar items principales y sus branches
    let yPos = 60;
    mainItems.forEach((item, index) => {
      const finalY = renderItemWithBranches(item, "root", xTrial, yPos, 0);

      if (index < mainItems.length - 1) {
        yPos = finalY + yStep;
      }
    });

    // Agregar edges entre items principales (secuencia vertical)
    for (let i = 0; i < mainItems.length - 1; i++) {
      const currentItem = mainItems[i];
      const nextItem = mainItems[i + 1];

      const currentNodeId =
        currentItem.type === "trial"
          ? `trial-${currentItem.id}`
          : `loop-${currentItem.id}`;
      const nextNodeId =
        nextItem.type === "trial"
          ? `trial-${nextItem.id}`
          : `loop-${nextItem.id}`;

      edges.push(createEdge(currentNodeId, nextNodeId));
    }

    return { nodes, edges };
  }, [
    trialsMetadata,
    selectedTrial,
    selectedLoop,
    onSelectTrial,
    onSelectLoop,
    onAddBranch,
    onOpenNestedLoop,
    getTrial,
    getLoop,
    size.width,
  ]);

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
          const totalTrialCount = trialsMetadata.length;

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
          const totalTrialCount = trialsMetadata.length;

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
              timeline={trialsMetadata}
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
