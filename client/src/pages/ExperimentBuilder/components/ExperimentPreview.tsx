import { useEffect, useState, useMemo } from "react";
import useUrl from "../hooks/useUrl";
import { useExperimentState } from "../hooks/useExpetimentState";
import useTrials from "../hooks/useTrials";
import { useExperimentID } from "../hooks/useExperimentID";
import useDevMode from "../hooks/useDevMode";
const API_URL = import.meta.env.VITE_API_URL;

function ExperimentPreview() {
  const { trialUrl } = useUrl();
  const { version, incrementVersion } = useExperimentState();
  const [started, setStarted] = useState(false);
  const [key, setKey] = useState(0);

  const experimentID = useExperimentID();
  const { isDevMode } = useDevMode();

  useEffect(() => {
    if (started && version) {
      setKey((prev) => prev + 1);
    }
  }, [version]);

  const handleStart = () => {
    setStarted(true);
    setKey((prev) => prev + 1);
  };

  const handleStop = () => {
    setStarted(false);
  };

  const { selectedTrial, selectedLoop } = useTrials();

  // trials preview
  useEffect(() => {
    if (
      (selectedTrial && selectedTrial.trialCode) ||
      (selectedLoop && selectedLoop.code)
    ) {
      const trialCode = `

        const trialSessionId =
            "${selectedTrial?.name}_result_" + (crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2, 10));

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
localStorage.removeItem('jsPsych_jumpToTrial');
  participantNumber = await saveSession(trialSessionId);

  if (typeof participantNumber !== "number" || isNaN(participantNumber)) {
    alert("The participant number is not assigned. Please, wait.");
    throw new Error("participantNumber not assigned");
  }
    const jsPsych = initJsPsych({
    display_element: document.getElementById('jspsych-container'),
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
              jsPsych.data.displayData();
          },
    });

      const timeline = [];
      
      ${selectedTrial?.trialCode || selectedLoop?.code || ""}

      jsPsych.run(timeline);
      
      })()
      `;

      (async () => {
        await fetch(`${API_URL}/api/trials-preview/${experimentID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generatedCode: trialCode }),
          credentials: "include",
          mode: "cors",
        });
        incrementVersion();
      })();
    }
  }, [selectedTrial, selectedLoop, experimentID]);

  // Crear URL con parámetros únicos para evitar caché

  return (
    <div>
      {!started && (
        <div>
          <button
            style={{ width: "100%", borderRadius: "5px" }}
            onClick={handleStart}
          >
            Run Demo
          </button>
        </div>
      )}

      {started && (
        <div>
          <button
            style={{ width: "100%", borderRadius: "5px" }}
            onClick={handleStop}
          >
            Stop Demo
          </button>
          <div style={{ width: "100%", height: "60vh", marginTop: "1rem" }}>
            <iframe
              key={key}
              src={trialUrl}
              title="Experiment Preview"
              width="100%"
              height="100%"
              style={{ border: "none" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ExperimentPreview;
