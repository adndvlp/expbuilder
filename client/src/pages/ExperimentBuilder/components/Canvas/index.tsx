import "@xyflow/react/dist/style.css";
import { FiRefreshCw } from "react-icons/fi";
import { TbBinaryTree } from "react-icons/tb";
import { FiX } from "react-icons/fi";
import { Trial } from "../ConfigPanel/types";
import LoopRangeModal from "../ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import useTrials from "../../hooks/useTrials";
import { useState } from "react";
import ReactFlow from "reactflow";
import TrialNode from "./TrialNode";
import LoopSubCanvas from "./LoopSubCanvas";
import BranchedTrial from "../ConfigPanel/TrialsConfig/BranchedTrial";

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
  const [openLoop, setOpenLoop] = useState<any>(null);
  const [showBranchedModal, setShowBranchedModal] = useState(false);

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
  let yPos = 100;
  const xTrial = 250;
  const yStep = 100;

  const trialIdsInLoops = trials
    .filter((item) => "trials" in item)
    .flatMap((loop: any) => loop.trials.map((t: any) => t.id));

  const allBlocks = trials.filter((item) =>
    isTrial(item) ? !trialIdsInLoops.includes(item.id) : true
  );

  allBlocks.forEach((item) => {
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
      draggable: false,
    });
    yPos += yStep;
  });

  let edges: any[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `e${nodes[i].id}-${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: "default",
    });
  }

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
    overflow: "visible",
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
          {selectedTrial && (
            <button
              style={{
                ...fabStyle,
                position: "static",
                width: 48,
                height: 48,
                fontSize: 24,
                background: "#4caf50",
                color: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
              title="Branch"
              onClick={() => setShowBranchedModal(true)}
            >
              <TbBinaryTree size={24} color="#fff" />
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
                    background: "none",
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
                  title="Cerrar"
                >
                  <FiX />
                </button>
                <BranchedTrial selectedTrial={selectedTrial} />
              </div>
            </div>
          )}
        </div>
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: 0 }}
        />
        {openLoop && openLoop.trials && (
          <LoopSubCanvas
            trials={openLoop.trials}
            loopName={openLoop.name}
            isDark={isDark}
            selectedTrial={selectedTrial}
            onClose={() => {
              setOpenLoop(null);
              setSelectedLoop(null);
            }}
            onSelectTrial={(trial) => {
              setSelectedTrial(trial);
              setSelectedLoop(null);
              const updatedLoop = trials.find((t: any) => t.id === openLoop.id);
              if (updatedLoop) setOpenLoop(updatedLoop);
            }}
            onUpdateTrial={(updatedTrial) => {
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
