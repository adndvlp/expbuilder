// src/components/Timeline.tsx
import { useEffect, useRef, useState } from "react";
import { Trial } from "./ConfigPanel/types";
import useTrials from "../hooks/useTrials";
import useUrl from "../hooks/useUrl";
import useDevMode from "../hooks/useDevMode";
import usePlugins from "../hooks/usePlugins";
import { useExperimentState } from "../hooks/useExpetimentState";
import FileUploader from "./ConfigPanel/components/TrialsConfig/components/FileUploader";
import { useFileUpload } from "./ConfigPanel/components/TrialsConfig/hooks/useFileUpload";

type TimelineProps = {};

function Component({}: TimelineProps) {
  const [submitStatus, setSubmitStatus] = useState<string>("");
  const { experimentUrl } = useUrl();
  const [copyStatus, setCopyStatus] = useState<string>("");

  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);

  const { trials, setTrials, selectedTrial, setSelectedTrial } = useTrials();
  const { isDevMode, code, setCode } = useDevMode();
  const { plugins } = usePlugins();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const didMount = useRef(false);

  const { incrementVersion } = useExperimentState();

  // For files in devmode
  const folder = "all";
  const accept = "audio/*,video/*,image/*";

  const {
    fileInputRef,
    folderInputRef,
    uploadedFiles,
    handleSingleFileUpload,
    handleFolderUpload,
    handleDeleteFile,
  } = useFileUpload({ folder });
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem(index);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedItem === null || draggedItem === dropIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const newTrials = [...trials];
    const draggedTrial = newTrials[draggedItem];

    // Remove the dragged item
    newTrials.splice(draggedItem, 1);

    // Insert at the new position
    let insertIndex;
    if (dropIndex >= trials.length) {
      // Si se suelta al final
      insertIndex = newTrials.length;
    } else {
      insertIndex = draggedItem < dropIndex ? dropIndex - 1 : dropIndex;
    }

    newTrials.splice(insertIndex, 0, draggedTrial);

    setTrials(newTrials);
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const onAddTrial = (type: string) => {
    // Obtén todos los nombres actuales
    const existingNames = trials.map((t) => t.name);

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
  };

  // Handle selecting a trial from the timeline
  const onSelectTrial = (trial: Trial) => {
    setSelectedTrial(trial);
  };

  const allTrialCodes = trials
    .map((trial) => trial.trialCode)
    .filter(Boolean)
    .join("\n\n");

  let extensions = "";

  // useEffect(() => {
  //   const includesExtension = trials.map(
  //     (trial) => trial.parameters?.includesExtensions
  //   );

  //   if (
  //     (includesExtension.length > 0 && includesExtension !== undefined) ||
  //     null
  //   ) {
  //     let rawExtensionsChain: string[] = [];
  //     trials.forEach((trial) => {
  //       rawExtensionsChain.push(trial.parameters?.extensionType);
  //     });

  //     rawExtensionsChain = [
  //       ...new Set(rawExtensionsChain.filter((val) => val !== "")),
  //     ];

  //     const extensionsArrayStr = rawExtensionsChain
  //       .map((e) => `{type: ${e}}`)
  //       .join(",");

  //     extensions = `extensions: [${extensionsArrayStr}],`;
  //   } else {
  //     extensions = "";
  //   }
  // }, [trials, isDevMode]);

  useEffect(() => {
    // Solo incluir extensiones si includesExtensions es true
    const rawExtensionsChain: string[] = [];
    trials.forEach((trial) => {
      if (trial.parameters?.includesExtensions) {
        if (trial.parameters?.extensionType) {
          rawExtensionsChain.push(trial.parameters.extensionType);
        }
      }
    });

    const uniqueExtensions = [
      ...new Set(rawExtensionsChain.filter((val) => val !== "")),
    ];

    if (uniqueExtensions.length > 0) {
      const extensionsArrayStr = uniqueExtensions
        .map((e) => `{type: ${e}}`)
        .join(",");
      extensions = `extensions: [${extensionsArrayStr}],`;
    } else {
      extensions = "";
    }
  }, [trials, isDevMode]);

  const generateExperiment = () => {
    return `

const trialSessionId =
    (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now());

// let isFirstSave = true;

  const jsPsych = initJsPsych({
    
  ${extensions}

  on_data_update: function(data) {

  fetch("/api/append-result", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
        sessionId: trialSessionId,
        response: data,
      }),
    });
  },

  
  // fetch("https://pipe.jspsych.org/api/data/", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json", Accept: "*/*" },
  //       body: JSON.stringify({
  //         experimentID: "tjStL4X8Yrep",
  //         data: JSON.stringify(data),
  //         filename: \` \${trialSessionId}\`,
  //         append: !isFirstSave,
  //       }),
  //     });

  //     isFirstSave = false;
  // },

  // Uncomment to see the json results after finishing a sesssion experiment
  // on_finish: function() {
  //   jsPsych.data.displayData();
  // },
});

const timeline = [];

const welcome = {
  type: jsPsychHtmlButtonResponse,
  stimulus: "Welcome to the experiment. Press 'Start' to begin.",
  choices: ['Start'],
};

timeline.push(welcome);

${allTrialCodes}

jsPsych.run(timeline);`;
  };

  const allTrialsHaveCode =
    trials.length > 0 &&
    trials.every((trial) => !!trial.trialCode && trial.trialCode.trim() !== "");

  // Handle running the experiment
  useEffect(() => {
    // Skip first load
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (isSubmitting || (!allTrialsHaveCode && !isDevMode)) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      setIsSubmitting(true);

      try {
        let generatedCode;
        isDevMode
          ? (generatedCode = code)
          : (generatedCode = generateExperiment());

        if (!isDevMode) {
          setSubmitStatus("Saving configuration...");
          const generatedCode = generateExperiment();

          setCode(generatedCode);

          const config = { generatedCode };

          // Paso 1: Guarda la configuración
          const response = await fetch("/api/save-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
            credentials: "include",
            mode: "cors",
          });

          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          const result = await response.json();
          if (!result.success) {
            setSubmitStatus("Failed to save configuration.");
            setIsSubmitting(false);
            return;
          }

          setSubmitStatus("Saved Configuration! Building experiment...");
        }

        // Paso 2: Llama al build/run-experiment

        setSubmitStatus("Running experiment...");
        const runResponse = await fetch("/api/run-experiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usePlugins: plugins.length > 0,
            generatedCode,
          }),
          credentials: "include",
          mode: "cors",
        });

        if (!runResponse.ok) {
          throw new Error(
            `Server responded with status: ${runResponse.status} when running experiment`
          );
        }

        const runResult = await runResponse.json();
        if (runResult.success) {
          // setExperimentUrl(result.urlExperiment);
          setSubmitStatus("Experiment ready!");
          // window.alert("Experiment ready!");
          setSubmitStatus("");
          incrementVersion();
          // window.open(runResult.experimentUrl, "_blank"); // <--- ABRE AUTOMÁTICAMENTE
        } else {
          setSubmitStatus(
            "Saved configuration but failed at running the experiment."
          );
          window.alert(
            "Saved configuration but failed at running the experiment."
          );
        }
      } catch (error) {
        console.error("Error submitting configuration:", error);
        setSubmitStatus(
          `An error occurred: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      } finally {
        setIsSubmitting(false);
        console.log(generateExperiment());
      }
    }, 3000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [trials, code, isDevMode, plugins]);

  const handleCopyLink = async () => {
    if (experimentUrl) {
      try {
        await navigator.clipboard.writeText(experimentUrl);
        setCopyStatus("Copied link!");
        setTimeout(() => setCopyStatus(""), 2000); // Clear message after 2 seconds
      } catch (err) {
        console.error("Failed to copy: ", err);
        setCopyStatus("Failed to copy link.");
      }
    }
  };

  return (
    <div className="timeline">
      <div>
        <img className="logo-img" alt="Logo" />
      </div>
      {/* Trials */}
      {/* {!isDevMode && (
        <div>
          {trials.map((trial) => (
            <div
              key={trial.id}
              className={`timeline-item ${
                selectedTrial && selectedTrial.id === trial.id ? "selected" : ""
              }`}
              onClick={() => onSelectTrial(trial)}
            >
              {trial.name}
            </div>
          ))}
          <div className="add-trial-button" onClick={() => onAddTrial("Trial")}>
            +
          </div>
        </div>
      )} */}

      {!isDevMode && (
        <div>
          {trials.map((trial, index) => (
            <div key={trial.id} style={{ position: "relative" }}>
              <div
                className={`timeline-item ${
                  selectedTrial && selectedTrial.id === trial.id
                    ? "selected"
                    : ""
                } ${draggedItem === index ? "dragging" : ""} ${
                  dragOverItem === index ? "drag-over" : ""
                }`}
                onClick={() => onSelectTrial(trial)}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  cursor: draggedItem === index ? "grabbing" : "grab",
                  position: "relative",
                  opacity: draggedItem === index ? 0.7 : 1,
                  transform:
                    dragOverItem === index ? "translateY(2px)" : "none",
                  borderTop:
                    dragOverItem === index ? "2px solid #d4af37" : "none",
                }}
              >
                {/* Flechas dentro del trial cuando está en dragging */}
                {draggedItem === index && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "8px",
                        width: 0,
                        height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderBottom: "8px solid var(--gold)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "5px",
                        right: "8px",
                        width: 0,
                        height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: "8px solid var(--gold)",
                      }}
                    />
                  </>
                )}
                {trial.name}
              </div>
            </div>
          ))}

          {/* Zona de drop al final */}

          <div
            className={`drop-zone-end ${dragOverItem === trials.length ? "drag-over" : ""}`}
            onDragOver={(e) => handleDragOver(e, trials.length)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, trials.length)}
            style={{
              height: draggedItem !== null ? "20px" : "0px",
              borderBottom: draggedItem !== null ? "2px solid #d4af37" : "none",

              transition: "all 0.2s ease",
            }}
          />

          <div className="add-trial-button" onClick={() => onAddTrial("Trial")}>
            +
          </div>
        </div>
      )}

      {/* Experiment */}
      <div>
        {submitStatus && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              borderRadius: "4px",
              backgroundColor: submitStatus.includes("success")
                ? "#d4edda"
                : submitStatus.includes("Failed") ||
                    submitStatus.includes("error")
                  ? "#f8d7da"
                  : "#cce5ff",
              color: submitStatus.includes("success")
                ? "#155724"
                : submitStatus.includes("Failed") ||
                    submitStatus.includes("error")
                  ? "#721c24"
                  : "#004085",
              textAlign: "center",
            }}
          >
            {submitStatus}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <a
            href={experimentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              width: "100%",
              padding: "10px 0",
              backgroundColor: "#4caf50",
              color: "#fff",
              textAlign: "center",
              textDecoration: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: 14,
              letterSpacing: "0.05em",
              transition: "background-color 0.3s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#43a047")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#4caf50")
            }
          >
            Open experiment
          </a>
          <button
            onClick={handleCopyLink}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 0",
              backgroundColor: "#2196f3",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: 14,
              letterSpacing: "0.05em",
              cursor: "pointer",
              marginTop: 12,
              transition: "background-color 0.3s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#1e88e5")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#2196f3")
            }
          >
            Copy Experiment Link
          </button>
          {copyStatus && (
            <p
              style={{
                fontSize: 13,
                color: copyStatus.includes("link!") ? "#4caf50" : "#f44336",
                textAlign: "center",
                marginTop: 8,
                fontWeight: "500",
              }}
            >
              {copyStatus}
            </p>
          )}
        </div>

        {isDevMode && (
          <div
            style={{
              margin: "16px 0",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              color: "var(--text-dark)",
            }}
          >
            <FileUploader
              uploadedFiles={uploadedFiles}
              onSingleFileUpload={handleSingleFileUpload}
              onFolderUpload={handleFolderUpload}
              onDeleteFile={handleDeleteFile}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              accept={accept}
            />
          </div>
        )}

        {/* Run Experiment Button */}

        {/* <div style={{ marginTop: "16px" }}>
          <button
            className="run-experiment-btn"
            onClick={handleRunExperiment}
            disabled={}
          >
            {isSubmitting
              ? "Processing..."
              : experimentUrl
                ? "Run Experiment"
                : "Run Experiment"}
          </button>
        </div> */}
      </div>
    </div>
  );
}

export default Component;
