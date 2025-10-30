import { FiRefreshCw } from "react-icons/fi";
import { Loop, Trial } from "./ConfigPanel/types";
import LoopRangeModal from "./ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import useTrials from "../hooks/useTrials";
import { useState } from "react";

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
    moveTrialOrLoop,
  } = useTrials();

  const [showLoopModal, setShowLoopModal] = useState(false);

  const [dragged, setDragged] = useState<{
    type: "trial" | "loop";
    id: string | number;
  } | null>(null);

  function isTrial(trial: any): trial is Trial {
    return "parameters" in trial;
  }

  const handleDragStart = (item: Trial | Loop) => {
    setDragged(
      isTrial(item)
        ? { type: "trial", id: item.id }
        : { type: "loop", id: item.id }
    );
  };

  const handleDrop = (
    target: Trial | Loop | null,
    position: "before" | "after" | "inside"
  ) => {
    if (dragged && moveTrialOrLoop) {
      moveTrialOrLoop({
        dragged,
        target: target
          ? { type: isTrial(target) ? "trial" : "loop", id: target.id }
          : { type: "trial", id: null }, // null para drop al final
        position,
      });
      setDragged(null);
    }
  };

  const onAddTrial = (type: string) => {
    // Obtén todos los nombres actuales
    const existingNames = [
      ...trials.filter((t) => "parameters" in t).map((t) => t.name),
      ...trials
        .filter((t) => "trials" in t)
        .flatMap((loop: any) => loop.trials.map((trial: any) => trial.name)),
    ];

    // Genera un nombre base
    let baseName = "New Trial";
    let newName = baseName;
    let counter = 1;

    // Busca un nombre que no exista
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
    setSelectedLoop(null); // Deselecciona el loop al agregar trial
  };

  // Handle selecting a trial from the timeline
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

  return (
    <div>
      {trials.map((item) => {
        if (isTrial(item)) {
          // Trial normal
          return (
            <div key={item.id} style={{ position: "relative" }}>
              <div
                className={`timeline-item ${
                  selectedTrial && selectedTrial.id === item.id
                    ? "selected"
                    : ""
                }`}
                onClick={() => {
                  onSelectTrial(item);
                  setSelectedLoop(null);
                }}
                draggable
                onDragStart={() => handleDragStart(item)}
                onDrop={() => handleDrop(item, "before")}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  cursor: "grab",
                  position: "relative",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "8px",
                }}
              >
                {item.name}
              </div>
            </div>
          );
        } else {
          // Loop y sus trials alineados
          const loop = item as Loop;
          const loopTrials = loop.trials;

          return (
            <div
              key={loop.id}
              style={{
                display: "flex",
                alignItems: "center",
                margin: "12px 0",
              }}
            >
              {/* Loop bloque */}
              <div
                className={`timeline-item timeline-loop ${selectedLoop?.id === loop.id ? "selected" : ""}`}
                style={{
                  width: "48%",
                  minWidth: "120px",
                  maxWidth: "180px",
                  marginRight: "8px",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setSelectedLoop(loop);
                  setSelectedTrial(null);
                }}
                draggable
                onDragStart={() => handleDragStart(loop)}
                onDrop={() => handleDrop(loop, "inside")}
                onDragOver={(e) => e.preventDefault()}
              >
                <strong>{loop.name}</strong>
              </div>
              {/* Trials dentro del loop */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                }}
              >
                {loopTrials.map((trial) => (
                  <div
                    key={trial.id}
                    className={`timeline-item ${
                      selectedTrial && selectedTrial.id === trial.id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => {
                      onSelectTrial(trial);
                      setSelectedLoop(null);
                    }}
                    draggable
                    onDragStart={() => handleDragStart(trial)}
                    onDrop={() => handleDrop(loop, "before")}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      width: "50%",
                      minWidth: "120px",
                      maxWidth: "180px",
                      marginBottom: "8px",
                      marginLeft: "auto",
                      borderRadius: "8px",
                      padding: "12px",
                      textAlign: "center",
                      cursor: "grab",
                    }}
                  >
                    {trial.name}
                  </div>
                ))}
              </div>
            </div>
          );
        }
      })}
      {/* Zona de drop al final */}
      <div
        className="drop-zone-end"
        onDrop={() => handleDrop(null, "after")}
        onDragOver={(e) => e.preventDefault()}
        style={{
          height: dragged ? "20px" : "0px",
          borderBottom: dragged ? "2px solid #d4af37" : "none",
          transition: "all 0.2s ease",
        }}
      />
      {showLoopModal && (
        <LoopRangeModal
          trials={trials.filter((t) => "id" in t) as Trial[]}
          onConfirm={handleAddLoop}
          onClose={() => setShowLoopModal(false)}
        />
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "13px",
          marginTop: "18px",
          marginBottom: "18px",
        }}
      >
        {/* Botón para agregar loop */}
        <div
          className="add-loop-button"
          style={{
            width: "40px",
            height: "40px",
            background: "#e5e5e5",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            margin: 0,
          }}
          onClick={() => setShowLoopModal(true)}
          title="Add loop"
        >
          {/* Ejemplo de ícono de loop, puedes usar un SVG */}
          <FiRefreshCw size={22} />
        </div>
        {/* Botón para agregar trial */}
        <div
          className="add-trial-button"
          style={{
            width: "40px",
            height: "40px",
            background: "#e5e5e5",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            margin: 0,
          }}
          onClick={() => onAddTrial("Trial")}
          title="Add trial"
        >
          {/* Puedes usar un ícono SVG aquí */}
          <span style={{ fontSize: "24px", fontWeight: "bold" }}>+</span>
        </div>
      </div>
    </div>
  );
}

export default Canvas;
