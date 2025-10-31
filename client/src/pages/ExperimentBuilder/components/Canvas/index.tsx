import { FiRefreshCw } from "react-icons/fi";
import { Trial } from "../ConfigPanel/types";
import LoopRangeModal from "../ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import useTrials from "../../hooks/useTrials";
import { useState } from "react";

import ReactFlow from "reactflow";
import TrialNode from "./TrialNode";
import LoopSubCanvas from "./LoopSubCanvas";

// Solo un tipo de nodo: trial
const nodeTypes = {
  trial: TrialNode,
};

type Props = {};

function Canvas({}: Props) {
  const {
    trials,
    setTrials,
    selectedTrial,
    setSelectedTrial,
    groupTrialsAsLoop,
    selectedLoop,
    setSelectedLoop,
  } = useTrials();

  const [showLoopModal, setShowLoopModal] = useState(false);
  const [openLoop, setOpenLoop] = useState<any>(null); // loop actualmente abierto

  function isTrial(trial: any): trial is Trial {
    return "parameters" in trial;
  }

  const onAddTrial = (type: string) => {
    const existingNames = [
      ...trials.filter((t) => "parameters" in t).map((t) => t.name),
      ...trials
        .filter((t) => "trials" in t)
        .flatMap((loop: any) => loop.trials.map((trial: any) => trial.name)),
    ];
    let baseName = "New Trial";
    let newName = baseName;
    let counter = 1;
    while (existingNames.includes(newName)) {
      newName = `${baseName} ${counter}`;
      counter++;
    }
    const newTrial: Trial = {
      id: Date.now(),
      type: type,
      name: newName,
      parameters: {},
      trialCode: "",
    };
    setTrials([...trials, newTrial]);
    setSelectedTrial(newTrial);
    setSelectedLoop(null);
  };

  const onSelectTrial = (trial: Trial) => {
    setSelectedTrial(trial);
  };

  const handleAddLoop = (trialIds: number[]) => {
    console.log(trials);
    // Encuentra los índices de los trials seleccionados
    const indices = trialIds
      .map((id) => trials.findIndex((t) => "id" in t && t.id === id))
      .filter((idx) => idx !== -1);

    if (indices.length > 1 && groupTrialsAsLoop) {
      groupTrialsAsLoop(indices);
    }
    setShowLoopModal(false);
    console.log(trials);
  };

  let nodes: any[] = [];
  let edges: any[] = [];
  let yPos = 100;
  const xTrial = 250;
  const yStep = 40;

  // Para el rediseño: los trials que están dentro de loops NO se renderizan, y los loops se renderizan como trials
  // Primero, obtener los ids de los trials que están dentro de loops
  const trialIdsInLoops = trials
    .filter((item) => "trials" in item)
    .flatMap((loop: any) => loop.trials.map((t: any) => t.id));

  // Renderizar los bloques en el orden original del array de trials, omitiendo los trials que están dentro de loops
  const allBlocks = trials.filter((item) =>
    isTrial(item) ? !trialIdsInLoops.includes(item.id) : true
  );

  allBlocks.forEach((item) => {
    // Usar TrialNode para ambos tipos
    nodes.push({
      id: isTrial(item) ? String(item.id) : `loop-${item.id}`,
      type: "trial",
      data: {
        name: item.name,
        selected: isTrial(item)
          ? selectedTrial && selectedTrial.id === item.id
          : (selectedLoop && selectedLoop.id === item.id) ||
            (openLoop && openLoop.id === item.id),
        onClick: () => {
          if (isTrial(item)) {
            onSelectTrial(item);
            setSelectedLoop(null);
            // Si el trial pertenece a un loop, mantener openLoop
            const parentLoop = trials.find(
              (t: any) =>
                t.trials && t.trials.some((tr: any) => tr.id === item.id)
            );
            if (parentLoop) {
              setOpenLoop(parentLoop);
            } else {
              setOpenLoop(null);
            }
          } else {
            setSelectedLoop(item);
            setSelectedTrial(null);
            setOpenLoop(item);
          }
        },
      },
      position: { x: xTrial, y: yPos },
    });
    if (nodes.length > 1) {
      edges.push({
        id: `e${nodes[nodes.length - 2].id}-${nodes[nodes.length - 1].id}`,
        source: String(nodes[nodes.length - 2].id),
        target: String(nodes[nodes.length - 1].id),
      });
    }
    yPos += yStep;
  });

  const isDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const canvasBg: React.CSSProperties = {
    background: isDark
      ? "radial-gradient(circle at 50% 50%, #23272f 80%, #181a20 100%)"
      : "radial-gradient(circle at 50% 50%, #f7f8fa 80%, #e9ecf3 100%)",
    minHeight: "100vh",
    width: "100%",
    height: "100vh",
    position: "relative",
    overflow: "hidden",
  };

  const patternStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    backgroundImage:
      "radial-gradient(circle, " +
      (isDark ? "#3a3f4b" : "#dbe2ea") +
      " 1px, transparent 1.5px)",
    backgroundSize: "28px 28px",
    zIndex: 0,
  };

  const fabStyle: React.CSSProperties = {
    width: "56px",
    height: "56px",
    background: isDark ? "#ffb300" : "#1976d2",
    color: isDark ? "#23272f" : "#fff",
    borderRadius: "50%",
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "fixed",
    bottom: "32px",
    right: "32px",
    zIndex: 10,
    fontSize: "32px",
    border: "none",
    outline: "none",
    transition: "background 0.2s",
  };

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
        {/* Botones en la esquina superior izquierda */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            display: "flex",
            gap: 16,
            zIndex: 10,
          }}
        >
          <button
            style={{
              ...fabStyle,
              position: "static",
              width: 48,
              height: 48,
              fontSize: 24,
              background: "#1976d2",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
            onClick={() => setShowLoopModal(true)}
            title="Add loop"
          >
            <FiRefreshCw size={24} color="#fff" />
          </button>
          <button
            style={{
              ...fabStyle,
              position: "static",
              width: 48,
              height: 48,
              fontSize: 28,
              background: "#ffb300",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
            onClick={() => onAddTrial("Trial")}
            title="Add trial"
          >
            <span style={{ fontWeight: "bold", color: "#fff" }}>+</span>
          </button>
        </div>
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            style: { stroke: isDark ? "#fff" : "#222", strokeWidth: 2 },
          }}
          style={{ background: "transparent", zIndex: 2 }}
        />
        {/* Sub-canvas para loop abierto (por selección de loop o trial interno) */}
        {openLoop && openLoop.trials && (
          <LoopSubCanvas
            trials={openLoop.trials}
            loopName={openLoop.name}
            isDark={isDark}
            onClose={() => {
              setOpenLoop(null);
              setSelectedLoop(null);
            }}
            selectedTrial={selectedTrial}
            onSelectTrial={(trial) => {
              setSelectedTrial(trial);
              setSelectedLoop(null);
              // Actualiza openLoop con la referencia actualizada desde trials
              const updatedLoop = trials.find((t: any) => t.id === openLoop.id);
              if (updatedLoop) setOpenLoop(updatedLoop);
            }}
            onUpdateTrial={(updatedTrial) => {
              // Actualiza el trial dentro del loop y refresca openLoop y trials
              const updatedLoops = trials.map((loop: any) => {
                if (loop.id === openLoop.id) {
                  return {
                    ...loop,
                    trials: loop.trials.map((t: any) =>
                      t.id === updatedTrial.id ? updatedTrial : t
                    ),
                  };
                }
                return loop;
              });
              setTrials(updatedLoops);
              const refreshedLoop = updatedLoops.find(
                (l: any) => l.id === openLoop.id
              );
              if (refreshedLoop) setOpenLoop(refreshedLoop);
            }}
          />
        )}
        {/* Modales igual que antes */}
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
                trials={trials.filter((t) => "id" in t) as Trial[]}
                onConfirm={handleAddLoop}
                onClose={() => setShowLoopModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Canvas;
