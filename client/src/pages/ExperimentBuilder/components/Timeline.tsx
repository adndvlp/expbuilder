// src/components/Timeline.tsx
import { useEffect, useState } from "react";
import { Loop, Trial } from "./ConfigPanel/types";
import useTrials from "../hooks/useTrials";
import useUrl from "../hooks/useUrl";
import useDevMode from "../hooks/useDevMode";
import FileUploader from "./ConfigPanel/TrialsConfig/FileUploader";
import { useFileUpload } from "./ConfigPanel/TrialsConfig/hooks/useFileUpload";
import { FiRefreshCw } from "react-icons/fi";
import LoopRangeModal from "./ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import { useExperimentID } from "../hooks/useExperimentID";
const API_URL = import.meta.env.VITE_API_URL;
const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;

type TimelineProps = {};

function Component({}: TimelineProps) {
  const [submitStatus, setSubmitStatus] = useState<string>("");
  const { experimentUrl } = useUrl();
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [publishStatus, setPublishStatus] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);

  const experimentID = useExperimentID();

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

  function isTrial(trial: any): trial is Trial {
    return "parameters" in trial;
  }

  const [showLoopModal, setShowLoopModal] = useState(false);

  const { isDevMode, code, setCode } = useDevMode();

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const [dragged, setDragged] = useState<{
    type: "trial" | "loop";
    id: string | number;
  } | null>(null);

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
  };

  // Handle selecting a trial from the timeline
  const onSelectTrial = (trial: Trial) => {
    setSelectedTrial(trial);
  };

  // const trialCodes = trials
  //   .filter((item) => "parameters" in item)
  //   .map((trial) => trial.trialCode)
  //   .filter(Boolean);

  // const loopCodes = trials
  //   .filter((item) => "trials" in item)
  //   .map((loop) => loop.code)
  //   .filter(Boolean);

  // const allCodes = [...trialCodes, ...loopCodes].join("\n\n");
  const allCodes = trials
    .map((item) => {
      if ("parameters" in item) return item.trialCode;
      if ("trials" in item) return item.code;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

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

  let extensions = "";

  useEffect(() => {
    // Solo incluir extensiones si includesExtensions es true
    const rawExtensionsChain: string[] = [];
    trials.forEach((trial) => {
      if (isTrial(trial) && trial.parameters?.includesExtensions) {
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

    // --- Función robusta para convertir JSON a CSV ---
  function jsonToCsv(data, options = {}) {
    if (!Array.isArray(data) || data.length === 0) return '';
    
    const config = {
      includeHeaders: options.includeHeaders !== false,
      delimiter: options.delimiter || ',',
      eol: options.eol || '\\n',
      fields: options.fields || null
    };

    let fields = config.fields;
    if (!fields || fields.length === 0) {
      const fieldsSet = new Set();
      data.forEach(row => {
        if (row && typeof row === 'object') {
          Object.keys(row).forEach(key => fieldsSet.add(key));
        }
      });
      fields = Array.from(fieldsSet);
    }

    if (fields.length === 0) return '';

    function formatValue(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        try {
          value = JSON.stringify(value);
        } catch (e) {
          value = String(value);
        }
      }
        let strValue = String(value);
      const needsQuotes = 
        strValue.includes(config.delimiter) ||
        strValue.includes('"') ||
        strValue.includes('\\n') ||
        strValue.includes('\\r');
      if (needsQuotes) {
        strValue = strValue.replace(/"/g, '""');
        return \`"\${strValue}"\`;
      }
      return strValue;
    }

    const csvRows = [];
    if (config.includeHeaders) {
      csvRows.push(fields.map(field => formatValue(field)).join(config.delimiter));
    }

    data.forEach(row => {
      if (!row || typeof row !== 'object') return;
      const values = fields.map(field => formatValue(row[field]));
      csvRows.push(values.join(config.delimiter));
    });

    return csvRows.join(config.eol);
  }

  // --- Firebase config ---
  const firebaseConfig = {
    apiKey: "${import.meta.env.VITE_FIREBASE_API_KEY}",
    authDomain: "${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}",
    databaseURL: "${import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://" + import.meta.env.VITE_FIREBASE_PROJECT_ID + ".firebaseio.com"}",
    projectId: "${import.meta.env.VITE_FIREBASE_PROJECT_ID}",
    storageBucket: "${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${import.meta.env.VITE_FIREBASE_APP_ID}"
  };

  // --- Cargar Firebase SDK ---
  if (typeof window.firebase === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
    script.onload = () => {
      const dbScript = document.createElement('script');
      dbScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
      dbScript.onload = () => { window._firebaseReady = true; };
      document.head.appendChild(dbScript);
    };
    document.head.appendChild(script);
  } else {
    window._firebaseReady = true;
  }

  function waitForFirebase() {
    return new Promise(resolve => {
      if (window._firebaseReady) return resolve();
      const interval = setInterval(() => {
        if (window._firebaseReady) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  function getUid() {
    try {
      const userStr = window.localStorage.getItem('user');
      if (userStr) return JSON.parse(userStr).uid;
    } catch (e) {}
    return undefined;
  }

  const trialSessionId =
    (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now());

  let participantNumber;

  async function saveSession(trialSessionId) {
    try {
      const res = await fetch("${DATA_API_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: "${experimentID}",
          sessionId: trialSessionId,
        }),
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error creating session:', errorText);
        throw new Error(\`Failed to create session: \${res.status} - \${errorText}\`);
      }
      
      const result = await res.json();
      console.log('Session created successfully:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to create session');
      }
      
      participantNumber = result.participantNumber;
      return participantNumber;
    } catch (error) {
      console.error('Error in saveSession:', error);
      alert('Error al crear la sesión: ' + error.message);
      throw error;
    }
  }

  (async () => {
    // Esperar e inicializar Firebase
    await waitForFirebase();
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    const db = window.firebase.database();

    participantNumber = await saveSession(trialSessionId);

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("El número de participante no está asignado. Por favor, espera.");
      throw new Error("participantNumber no asignado");
    }

    // --- Configurar onDisconnect para finalizar sesión automáticamente ---
    const sessionRef = db.ref('sessions/${experimentID}/' + trialSessionId);
    await sessionRef.set({
      connected: true,
      experimentID: '${experimentID}',
      sessionId: trialSessionId,
      startedAt: window.firebase.database.ServerValue.TIMESTAMP
    });
    
    // Cuando se desconecte, marcar para que el backend finalice la sesión
    // Incluir needsFinalization para que se procesen los datos en caso de desconexión
    sessionRef.onDisconnect().update({
      connected: false,
      needsFinalization: true,
      disconnectedAt: window.firebase.database.ServerValue.TIMESTAMP
    });

    const jsPsych = initJsPsych({

    ${extensions}

    on_data_update: function (data) {
    const csvData = jsonToCsv([data], {
        includeHeaders: true
      });
      fetch("${DATA_API_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: "${experimentID}",
          sessionId: trialSessionId,
          data: csvData,
        }),
      })
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => {
            console.error('Error appending data:', text);
          });
        }
        return res.json();
      })
      .then(result => {
        if (result && result.success) {
          console.log('Data appended to temporary storage');
        }
      })
      .catch(error => {
        console.error('Error in on_data_update:', error);
      });
    },

  on_finish: async function() {
    
    // Cancelar el onDisconnect para evitar conflictos
    sessionRef.onDisconnect().cancel();

    // Finalizar la sesión normalmente y marcar en Firebase que terminó correctamente
    console.log('Experiment finished normally, sending data to Google Drive...');
    
    try {
      
      // Marcar en Firebase que terminó correctamente Y necesita finalización
      await sessionRef.update({
        connected: false,
        finished: true,
        needsFinalization: true,
        finishedAt: window.firebase.database.ServerValue.TIMESTAMP
      });
      
      // El backend procesará la finalización al detectar needsFinalization=true
      console.log('Session marked for finalization in Firebase');
    } catch (error) {
      console.error('Error marking session as finished:', error);
    }
  },
  // Uncomment to see the json results after finishing a session experiment
  // jsPsych.data.displayData('csv');
});

const timeline = [];

const welcome = {
  type: jsPsychHtmlButtonResponse,
  stimulus: "Welcome to the experiment. Press 'Start' to begin.",
  choices: ['Start'],
};

timeline.push(welcome);

${allCodes}

jsPsych.run(timeline);

})();
`;
  };

  const handleRunExperiment = async () => {
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
        const response = await fetch(
          `${API_URL}/api/save-config/${experimentID}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
            credentials: "include",
            mode: "cors",
          }
        );

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
      const runResponse = await fetch(
        `${API_URL}/api/run-experiment/${experimentID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generatedCode }),
          credentials: "include",
          mode: "cors",
        }
      );

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
  };

  const hasTrials = trials.filter(isTrial).length > 0;
  const hasLoops = trials.filter((item) => "trials" in item).length > 0;

  const allTrialsHaveCode =
    !hasTrials ||
    trials
      .filter(isTrial)
      .every((trial) => !!trial.trialCode && trial.trialCode.trim() !== "");

  const allLoopsHaveCode =
    !hasLoops ||
    trials
      .filter((item) => "trials" in item)
      .every((loop) => !!loop.code && loop.code.trim() !== "");

  const isDisabled =
    isSubmitting || ((!allTrialsHaveCode || !allLoopsHaveCode) && !isDevMode);

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

  const handlePublishToGitHub = async () => {
    setIsPublishing(true);
    setPublishStatus("Publishing to GitHub...");

    try {
      const userStr = window.localStorage.getItem("user");
      if (!userStr) {
        setPublishStatus("Error: User not logged in");
        setIsPublishing(false);
        return;
      }
      const user = JSON.parse(userStr);
      const uid = user.uid;

      const response = await fetch(
        `${API_URL}/api/publish-experiment/${experimentID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid }),
          credentials: "include",
          mode: "cors",
        }
      );

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setPublishStatus(`Published! GitHub Pages URL: ${result.pagesUrl}`);
        // Optionally copy the GitHub Pages URL
        try {
          await navigator.clipboard.writeText(result.pagesUrl);
          setTimeout(() => {
            setPublishStatus((prev) => prev + " (copied to clipboard)");
          }, 100);
        } catch (err) {
          console.error("Failed to copy GitHub Pages URL: ", err);
        }
      } else {
        setPublishStatus(`Error: ${result.message || "Failed to publish"}`);
      }
    } catch (error) {
      console.error("Error publishing to GitHub:", error);
      setPublishStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsPublishing(false);
      // Clear status after 5 seconds
      setTimeout(() => setPublishStatus(""), 5000);
    }
  };

  return (
    <div className="timeline">
      <div style={{ marginBottom: "8px" }}>
        <img className="logo-img" alt="Logo" />
      </div>

      {!isDevMode && (
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

        {/* Run Experiment Button */}

        <div style={{ marginTop: "16px" }}>
          <button
            className="run-experiment-btn"
            onClick={handleRunExperiment}
            disabled={isDisabled}
          >
            {isSubmitting
              ? "Processing..."
              : experimentUrl
                ? "Run Experiment"
                : "Run Experiment"}
          </button>
        </div>

        {/* Publish to GitHub Button */}
        <div style={{ marginTop: "12px" }}>
          <button
            onClick={handlePublishToGitHub}
            disabled={isPublishing || !experimentUrl}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 0",
              backgroundColor:
                isPublishing || !experimentUrl ? "#cccccc" : "#ff9800",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: 14,
              letterSpacing: "0.05em",
              cursor:
                isPublishing || !experimentUrl ? "not-allowed" : "pointer",
              transition: "background-color 0.3s ease",
            }}
            onMouseEnter={(e) => {
              if (!isPublishing && experimentUrl) {
                e.currentTarget.style.backgroundColor = "#f57c00";
              }
            }}
            onMouseLeave={(e) => {
              if (!isPublishing && experimentUrl) {
                e.currentTarget.style.backgroundColor = "#ff9800";
              }
            }}
          >
            {isPublishing ? "Publishing..." : "Publish to GitHub Pages"}
          </button>
          {publishStatus && (
            <p
              style={{
                fontSize: 13,
                color: publishStatus.includes("Error") ? "#f44336" : "#4caf50",
                textAlign: "center",
                marginTop: 8,
                fontWeight: "500",
                wordBreak: "break-word",
              }}
            >
              {publishStatus}
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
      </div>
    </div>
  );
}

export default Component;
