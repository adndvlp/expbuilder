import "@xyflow/react/dist/style.css";
import { useState } from "react";
import ReactFlow, { Connection } from "reactflow";
import useTrials from "../../hooks/useTrials";
import { Trial } from "../ConfigPanel/types";
import TrialNode from "./TrialNode";
import LoopNode from "./LoopNode";
import LoopSubCanvas from "./LoopSubCanvas";
import LoopRangeModal from "../ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import BranchedTrial from "../ConfigPanel/TrialsConfig/BranchedTrial";
import CanvasToolbar from "./components/CanvasToolbar";
import { useFlowLayout } from "./hooks/useFlowLayout";

import { FiX } from "react-icons/fi";
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

type Props = {};

function Canvas({}: Props) {
  const {
    timeline,
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
  const [openLoopMetadata, setOpenLoopMetadata] = useState<any[]>([]);
  const [loopStack, setLoopStack] = useState<
    Array<{ id: string; name: string }>
  >([]); // Stack for nested loops
  const [showBranchedModal, setShowBranchedModal] = useState(false);

  const onAddTrial = async (type: string) => {
    // Generar nombre único basado en timeline
    const existingNames = timeline.map((item) => item.name);
    const newName = generateUniqueName(existingNames);

    try {
      const newTrial = await createTrial({
        type: type,
        name: newName,
        parameters: {},
        trialCode: "",
      });

      setSelectedTrial(newTrial);
      setSelectedLoop(null);
    } catch (error) {
      console.error("Error creating trial:", error);
    }
  };

  const handleCreateLoop = () => {
    const confirmed = window.confirm(
      "Are you sure you want to group these trials/loops into a loop?"
    );
    if (!confirmed) {
      return;
    }

    // Mostrar modal para seleccionar rango
    setShowLoopModal(true);
  };

  const handleAddLoop = async (itemIds: (number | string)[]) => {
    if (itemIds.length < 2) {
      alert("You must select at least 2 trials/loops to create a loop.");
      setShowLoopModal(false);
      return;
    }

    try {
      // Contar loops existentes para generar nombre
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
        trials: itemIds, // Solo IDs
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

  // Cargar loop completo y metadata cuando se abre
  const handleOpenLoop = async (loopId: string) => {
    try {
      const loopData = await getLoop(loopId);
      const metadata = await getLoopTimeline(loopId);

      if (loopData) {
        setOpenLoop(loopData);
        setOpenLoopMetadata(metadata);
      }
    } catch (error) {
      console.error("Error loading loop:", error);
    }
  };

  // Recargar metadata del loop abierto
  const handleRefreshLoopMetadata = async () => {
    if (!openLoop) return;
    try {
      const metadata = await getLoopTimeline(openLoop.id);
      setOpenLoopMetadata(metadata);
    } catch (error) {
      console.error("Error refreshing loop metadata:", error);
    }
  };

  const onAddBranch = async (parentId: number | string) => {
    const existingNames = timeline.map((item) => item.name);
    const newName = generateUniqueName(existingNames);

    try {
      const newBranchTrial = await createTrial({
        type: "Trial",
        name: newName,
        parameters: {},
        trialCode: "",
      });

      // Actualizar el parent (trial o loop) para incluir este branch
      const parentItem = timeline.find((item) => item.id === parentId);
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

      setSelectedTrial(newBranchTrial);
    } catch (error) {
      console.error("Error adding branch:", error);
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
      // Buscar el source en timeline
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
    getTrial,
    getLoop,
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
        />

        {/* Params Override Button - Now integrated in BranchedTrial modal */}
        {/* Removed standalone button - accessible via Branches modal > Params Override tab */}

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
                selectedTrial={selectedTrial || selectedLoop}
                onClose={() => setShowBranchedModal(false)}
              />
            </div>
          </div>
        )}

        {/* ParamsOverride modal removed - now integrated in BranchedTrial modal */}

        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: 0 }}
          onConnect={handleConnect}
        />

        {openLoop && (
          <LoopSubCanvas
            loopId={openLoop.id}
            loopName={openLoop.name}
            loopTimeline={openLoopMetadata}
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
              setOpenLoopMetadata([]);
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
                setOpenLoopMetadata([]);
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
                (l) => l.id === openLoop.id
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
      </div>
    </div>
  );
}

export default Canvas;
