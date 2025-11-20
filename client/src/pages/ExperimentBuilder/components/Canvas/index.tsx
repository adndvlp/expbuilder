import "@xyflow/react/dist/style.css";
import { useState, useEffect } from "react";
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
import {
  generateUniqueName,
  getAllExistingNames,
  validateConnection,
} from "./utils/trialUtils";
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
    trials,
    setTrials,
    selectedTrial,
    setSelectedTrial,
    selectedLoop,
    setSelectedLoop,
    groupTrialsAsLoop,
  } = useTrials();

  const [showLoopModal, setShowLoopModal] = useState(false);
  const [openLoop, setOpenLoop] = useState<any>(null);
  const [loopStack, setLoopStack] = useState<
    Array<{ id: string; name: string; trials: any[] }>
  >([]); // Stack for nested loops
  const [showBranchedModal, setShowBranchedModal] = useState(false);

  const onAddTrial = (type: string) => {
    const existingNames = getAllExistingNames(trials);
    const newName = generateUniqueName(existingNames);

    const newTrial: Trial = {
      id: Date.now(),
      type: type,
      name: newName,
      parameters: {},
      trialCode: "",
    };

    // If there's a selected trial or loop, insert the new trial after it
    // Otherwise, add it at the end
    if (selectedTrial) {
      const selectedIndex = trials.findIndex(
        (t: any) => "id" in t && t.id === selectedTrial.id
      );
      if (selectedIndex !== -1) {
        const newTrials = [...trials];
        newTrials.splice(selectedIndex + 1, 0, newTrial);
        setTrials(newTrials);
      } else {
        setTrials([...trials, newTrial]);
      }
    } else if (selectedLoop) {
      const selectedIndex = trials.findIndex(
        (t: any) => "id" in t && t.id === selectedLoop.id
      );
      if (selectedIndex !== -1) {
        const newTrials = [...trials];
        newTrials.splice(selectedIndex + 1, 0, newTrial);
        setTrials(newTrials);
      } else {
        setTrials([...trials, newTrial]);
      }
    } else {
      setTrials([...trials, newTrial]);
    }

    setSelectedTrial(newTrial);
    setSelectedLoop(null);
  };

  const handleCreateLoop = () => {
    // Si hay un trial seleccionado, verificar si tiene branches
    if (selectedTrial) {
      const trialWithBranches = trials.find(
        (t: any) => "id" in t && t.id === selectedTrial.id
      ) as Trial | undefined;

      if (
        trialWithBranches &&
        trialWithBranches.branches &&
        trialWithBranches.branches.length > 0
      ) {
        // El trial tiene branches, crear el loop inmediatamente
        const trialIndex = trials.findIndex(
          (t: any) => "id" in t && t.id === selectedTrial.id
        );

        if (trialIndex !== -1) {
          // Función recursiva para obtener todos los trial IDs (incluyendo branches anidados)
          const getAllNestedTrialIds = (
            trialId: number | string,
            visited = new Set<number | string>()
          ): Set<number | string> => {
            const allIds = new Set<number | string>();

            // Evitar ciclos infinitos
            if (visited.has(trialId)) {
              return allIds;
            }
            visited.add(trialId);

            // Agregar el ID actual
            allIds.add(trialId);

            // Encontrar el trial actual
            const currentTrial = trials.find(
              (t: any) => "id" in t && t.id === trialId
            ) as Trial | undefined;

            if (
              currentTrial &&
              currentTrial.branches &&
              currentTrial.branches.length > 0
            ) {
              // Recursivamente agregar branches y sus sub-branches
              currentTrial.branches.forEach((branchId) => {
                const nestedIds = getAllNestedTrialIds(branchId, visited);
                nestedIds.forEach((nestedId) => allIds.add(nestedId));
              });
            }

            return allIds;
          };

          // Obtener todos los trial IDs (el principal y todos sus branches anidados)
          const allTrialIds = getAllNestedTrialIds(selectedTrial.id);

          // Convertir los IDs a índices
          const allIndices = Array.from(allTrialIds)
            .map((trialId) =>
              trials.findIndex((t: any) => "id" in t && t.id === trialId)
            )
            .filter((idx) => idx !== -1);

          if (groupTrialsAsLoop) {
            groupTrialsAsLoop(allIndices);
          }
        }
        return;
      }
    }

    // Si no hay trial seleccionado o no tiene branches, mostrar el modal
    setShowLoopModal(true);
  };

  const handleAddLoop = (itemIds: (number | string)[]) => {
    const indices = itemIds
      .map((id) => trials.findIndex((t: any) => t.id === id))
      .filter((idx) => idx !== -1);

    if (indices.length < 2) {
      alert("You must select at least 2 trials/loops to create a loop.");
      setShowLoopModal(false);
      return;
    }

    if (groupTrialsAsLoop) {
      groupTrialsAsLoop(indices);
    }
    setShowLoopModal(false);
  };

  // Keep openLoop synchronized with trials updates
  useEffect(() => {
    if (openLoop) {
      // Helper recursivo para buscar el loop en cualquier nivel
      const findLoop = (items: any[], loopId: string): any => {
        for (const item of items) {
          if (item.id === loopId) {
            return item;
          }
          if ("trials" in item && item.trials) {
            const found = findLoop(item.trials, loopId);
            if (found) return found;
          }
        }
        return null;
      };

      const updatedLoop = findLoop(trials, openLoop.id);
      if (!updatedLoop) {
        // Loop was deleted
        setOpenLoop(null);
      } else if ("trials" in updatedLoop) {
        // Loop exists, update it to reflect changes in trials
        setOpenLoop(updatedLoop);
      }
    }
  }, [trials]);

  const onAddBranch = (parentId: number | string) => {
    const existingNames = getAllExistingNames(trials);
    const newName = generateUniqueName(existingNames);

    const newBranchTrial: Trial = {
      id: Date.now(),
      type: "Trial",
      name: newName,
      parameters: {},
      trialCode: "",
    };

    // Add the new trial to trials list
    const updatedTrials = [...trials, newBranchTrial];

    // Update the parent (trial or loop) to include this branch
    const updatedTrialsWithBranch = updatedTrials.map((t: any) => {
      if ("parameters" in t && t.id === parentId) {
        return {
          ...t,
          branches: [...(t.branches || []), newBranchTrial.id],
        };
      } else if ("trials" in t && t.id === parentId) {
        return {
          ...t,
          branches: [...(t.branches || []), newBranchTrial.id],
        };
      }
      return t;
    });

    setTrials(updatedTrialsWithBranch);
    setSelectedTrial(newBranchTrial);
  };

  // Handler for connecting trials manually
  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Extract the actual trial IDs from the node IDs
    // Node IDs can be like "123" or "loop-456" for main sequence
    // or "123-789" for branches
    const extractTrialId = (nodeId: string): number | string | null => {
      // Remove "loop-" prefix if present
      if (nodeId.startsWith("loop-")) {
        return nodeId.substring(5);
      }
      // For branch nodes, get the last segment (the actual trial ID)
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

    // Validate the connection
    const validation = validateConnection(sourceId, targetId, trials);
    if (!validation.isValid) {
      alert(validation.errorMessage || "Invalid connection");
      return;
    }

    // Add targetId to the branches array of the source trial/loop
    const updatedTrials = trials.map((t: any) => {
      if ("parameters" in t && t.id === sourceId) {
        // It's a Trial
        const branches = t.branches || [];
        // Only add if not already present
        if (!branches.includes(targetId)) {
          return {
            ...t,
            branches: [...branches, targetId],
          };
        }
      } else if ("trials" in t && t.id === sourceId) {
        // It's a Loop
        const branches = t.branches || [];
        if (!branches.includes(targetId)) {
          return {
            ...t,
            branches: [...branches, targetId],
          };
        }
      }
      return t;
    });

    setTrials(updatedTrials);
  };

  const { nodes, edges } = useFlowLayout({
    trials,
    selectedTrial,
    selectedLoop,
    onSelectTrial: (trial) => {
      setSelectedTrial(trial);
      setSelectedLoop(null);
    },
    onSelectLoop: (loop) => {
      setSelectedLoop(loop);
      setSelectedTrial(null);
    },
    onAddBranch,
    openLoop,
    setOpenLoop,
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

        {openLoop && openLoop.trials && (
          <LoopSubCanvas
            trials={openLoop.trials}
            loopName={openLoop.name}
            loopId={openLoop.id}
            isDark={isDark}
            selectedTrial={selectedTrial}
            selectedLoop={selectedLoop}
            loopStack={loopStack}
            allTrials={trials}
            setAllTrials={setTrials}
            onNavigateToLoop={(index) => {
              // Navegar a un loop específico en el stack
              if (index < loopStack.length) {
                const targetLoop = loopStack[index];
                setOpenLoop(targetLoop);
                setLoopStack(loopStack.slice(0, index));
              }
            }}
            onNavigateToRoot={() => {
              // Volver al canvas principal (cerrar todos los loops)
              setOpenLoop(null);
              setSelectedLoop(null);
              setLoopStack([]);
            }}
            onClose={() => {
              if (loopStack.length > 0) {
                // Si hay un stack, volver al loop anterior
                const previousLoop = loopStack[loopStack.length - 1];
                setOpenLoop(previousLoop);
                setLoopStack(loopStack.slice(0, -1));
              } else {
                // Si no hay stack, cerrar completamente
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
            onOpenNestedLoop={(nestedLoop) => {
              // Agregar el loop actual al stack solo si no está ya presente
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
                      trials: openLoop.trials,
                    },
                  ];

              setLoopStack(newStack);
              setOpenLoop(nestedLoop);
              setSelectedLoop(nestedLoop);
              setSelectedTrial(null);
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
                trials={trials}
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
