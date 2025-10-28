// src/components/Timeline.tsx
import { useEffect, useState } from "react";
import { openExternal } from "../../../lib/openExternal";
import { Loop, Trial } from "./ConfigPanel/types";
import useTrials from "../hooks/useTrials";
import useUrl from "../hooks/useUrl";
import useDevMode from "../hooks/useDevMode";
import FileUploader from "./ConfigPanel/TrialsConfig/FileUploader";
import { useFileUpload } from "./ConfigPanel/TrialsConfig/hooks/useFileUpload";
import { FiRefreshCw } from "react-icons/fi";
import LoopRangeModal from "./ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import {
  fetchExperimentNameByID,
  useExperimentID,
} from "../hooks/useExperimentID";
import { useExperimentStorage } from "../hooks/useStorage";
const API_URL = import.meta.env.VITE_API_URL;
const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;

type TimelineProps = {};

function Component({}: TimelineProps) {
  const [submitStatus, setSubmitStatus] = useState<string>("");
  const { experimentUrl, setExperimentUrl } = useUrl();
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [tunnelStatus, setTunnelStatus] = useState<string>("");
  const [isTunnelActive, setTunnelActive] = useState<boolean>(false);
  const [lastPagesUrl, setLastPagesUrl] = useState<string>("");
  const [publishStatus, setPublishStatus] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);

  const [experimentName, setExperimentName] = useState("Experiment");

  const experimentID = useExperimentID();
  useEffect(() => {
    if (experimentID) {
      fetchExperimentNameByID(experimentID).then(setExperimentName);
    }
  }, [experimentID]);

  // Obtén el storage desde el hook, pero si está undefined, usa el valor cacheado en localStorage
  let storage = useExperimentStorage(experimentID ?? "");
  if (!storage && experimentID) {
    try {
      const cached = localStorage.getItem(`experiment_storage_${experimentID}`);
      if (cached) storage = cached;
    } catch (e) {
      // Ignorar errores de localStorage
    }
  }

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

  const generateLocalExperiment = () => {
    return `
  const trialSessionId =
    (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now());

  let participantNumber;

  async function saveSession(trialSessionId) {
   
   const res = await fetch("/api/append-result/${experimentID}", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({
        sessionId: trialSessionId,
      }),
    });
  
    const result = await res.json();
    participantNumber = result.participantNumber;
    return participantNumber;
    
  }

  (async () => {
    participantNumber = await saveSession(trialSessionId);

    if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
    }

    const jsPsych = initJsPsych({

    ${extensions}

    on_data_update: function (data) {
      const res = fetch("/api/append-result/${experimentID}", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          sessionId: trialSessionId,
          response: data,
        }),
      });
    },

  on_finish: function() {
    jsPsych.data.displayData
  }
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

  const generateExperiment = () => {
    return `
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

 
  const userStr = ${window.localStorage.getItem("user")};

  const Uid = userStr.uid

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
          experimentName: "${experimentName}", 
          sessionId: trialSessionId,
          storage: "${storage}",
          uid: Uid
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
        if (result.message?.includes("INVALID_GOOGLE_DRIVE_TOKEN") || result.message?.includes("Invalid Google Drive token")) {
          alert("Warning: Google Drive token not found or invalid. Please reconnect your Drive account in Settings.");
        } else if (result.message?.includes("INVALID_DROPBOX_TOKEN") || result.message?.includes("Invalid Dropbox token")) {
          alert("Warning: Dropbox token not found or invalid. Please reconnect your Dropbox account in Settings.");
        }
        throw new Error(result.message || 'Failed to create session');
      }
      
      participantNumber = result.participantNumber;
      return participantNumber;
    } catch (error) {
      console.error('Error in saveSession:', error);
      alert('Error creating session: ' + error.message);
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
      alert("The participant number is not assigned. Please, wait.");
      throw new Error("participantNumber not assigned");
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
    
      const csvData= jsPsych.data.getLastTrialData().csv()

      fetch("${DATA_API_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: "${experimentID}",
          sessionId: trialSessionId,
          data: csvData,
          storage: "${storage}",
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
        : (generatedCode = generateLocalExperiment());

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
      // console.log(generateExperiment());
    }
  };

  const handleShareLocalExperiment = async () => {
    const confirm = window.confirm(
      "Warning: All your local experiments will be public until you close the tunnel or exit the app. Anyone with a link can access them."
    );
    if (!confirm) return;
    try {
      const res = await fetch(`${API_URL}/api/create-tunnel`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.success) {
        setExperimentUrl(`${data.url}/${experimentID}-experiment`);
        // Persist tunnel state in localStorage (global, not per experiment)
        localStorage.setItem("tunnelActive", "true");
        localStorage.setItem("tunnelUrl", data.url);
        let url = `${data.url}/${experimentID}-experiment`;
        try {
          await navigator.clipboard.writeText(url);
          setTunnelStatus("Public link copied to clipboard");
        } catch (err) {
          console.error("Failed to copy public link: ", err);
        }
        setTunnelActive(true);
        setTimeout(() => setTunnelStatus(""), 4000);
        return url;
      } else {
        console.error("Error creating tunnel:", data.error);
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const handleCloseTunnel = async () => {
    const confirm = window.confirm(
      "Stop sharing your local experiment? Participants won't be able to access it until you reopen the tunnel. Collected results will not be lost."
    );
    if (!confirm) return;
    try {
      const res = await fetch(`${API_URL}/api/close-tunnel`, {
        method: "POST",
      });
      const data = await res.json();

      setExperimentUrl(`${API_URL}/${experimentID}-experiment`);
      setTunnelActive(false);
      localStorage.removeItem("tunnelActive");
      localStorage.removeItem("tunnelUrl");
      if (data.success) {
        setTunnelStatus(data.message);
      } else {
        setTunnelStatus("Error closing tunnel");
        console.error(data.message);
      }
      setTimeout(() => setTunnelStatus(""), 2000);
    } catch (err) {
      console.error("Error closing tunnel:", err);
    }
  };
  // Restore tunnel state on mount (global, always show for current experiment)
  useEffect(() => {
    const tunnelActive = localStorage.getItem("tunnelActive") === "true";
    const tunnelUrl = localStorage.getItem("tunnelUrl");
    if (tunnelActive && tunnelUrl) {
      setTunnelActive(true);
      setExperimentUrl(`${tunnelUrl}/${experimentID}-experiment`);
    }
    // eslint-disable-next-line
  }, [experimentID, setExperimentUrl]);

  const handleCopyLink = async () => {
    if (lastPagesUrl) {
      try {
        await navigator.clipboard.writeText(lastPagesUrl);
        setCopyStatus("Link copied!");
        setTimeout(() => setCopyStatus(""), 2000); // Clear message after 2 seconds
      } catch (err) {
        console.error("Failed to copy: ", err);
        setCopyStatus("Failed to copy link.");
      }
    } else {
      setCopyStatus("No published link available.");
      setTimeout(() => setCopyStatus(""), 2000);
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

      if (
        !result.success &&
        result.message?.includes("GitHub token not found or invalid")
      ) {
        setPublishStatus(
          "Warning: GitHub publish failed. Please reconnect your GitHub account in Settings."
        );
        // Opcional: podría redirigir al usuario a Settings
        return;
      }
      if (result.success) {
        setPublishStatus(`Published! GitHub Pages URL`);
        setLastPagesUrl(result.pagesUrl || "");
        // Optionally copy the GitHub Pages URL
        try {
          await navigator.clipboard.writeText(result.pagesUrl);
          setTimeout(() => {
            setPublishStatus((prev) => prev + " copied to clipboard");
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
                ? "Build Experiment"
                : "Build Experiment"}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
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
              cursor: localStorage.getItem("tunnelUrl")
                ? "pointer"
                : experimentUrl
                  ? "pointer"
                  : "not-allowed",
              opacity: localStorage.getItem("tunnelUrl")
                ? 1
                : experimentUrl
                  ? 1
                  : 0.6,
            }}
            disabled={!(localStorage.getItem("tunnelUrl") || experimentUrl)}
            onClick={() => {
              const url = localStorage.getItem("tunnelUrl")
                ? `${localStorage.getItem("tunnelUrl")}/${experimentID}-experiment`
                : experimentUrl;
              if (url) openExternal(url);
            }}
            onMouseEnter={(e) => {
              const url = localStorage.getItem("tunnelUrl") || experimentUrl;
              if (url) e.currentTarget.style.backgroundColor = "#43a047";
            }}
            onMouseLeave={(e) => {
              const url = localStorage.getItem("tunnelUrl") || experimentUrl;
              if (url) e.currentTarget.style.backgroundColor = "#4caf50";
            }}
          >
            Run experiment
          </button>
          <button
            style={{
              display: "block",
              width: "100%",
              padding: "10px 0",
              backgroundColor: isTunnelActive ? "#cccccc" : "#604cafff",
              color: "#fff",
              textAlign: "center",
              textDecoration: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: 14,
              letterSpacing: "0.05em",
              marginTop: 12,
              transition: "background-color 0.3s ease",
              cursor: isTunnelActive ? "not-allowed" : "pointer",
              opacity: isTunnelActive ? 0.6 : 1,
            }}
            onClick={isTunnelActive ? undefined : handleShareLocalExperiment}
            disabled={isTunnelActive}
          >
            Share Local Experiment
          </button>
          {tunnelStatus && (
            <div style={{ marginTop: 6 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "#4caf50",
                  textAlign: "center",
                  marginTop: 8,
                  fontWeight: "500",
                }}
              >
                {tunnelStatus}
              </p>
            </div>
          )}
          {isTunnelActive && (
            <button
              style={{ marginTop: 6, marginBottom: 6, width: "100%" }}
              onClick={handleCloseTunnel}
              className="remove-button"
            >
              Close tunnel
            </button>
          )}
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
                color: copyStatus.includes("copied!") ? "#4caf50" : "#f44336",
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
      </div>
    </div>
  );
}

export default Component;
