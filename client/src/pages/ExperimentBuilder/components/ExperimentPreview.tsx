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

  const { selectedTrial, selectedLoop, trials } = useTrials();

  // Helper function to recursively find all trials at any depth
  const getAllTrialsRecursively = (items: any[]): any[] => {
    const allTrials: any[] = [];

    const traverse = (itemsList: any[]) => {
      itemsList.forEach((item: any) => {
        // If it's a trial (has parameters), add it
        if ("parameters" in item) {
          allTrials.push(item);
        }
        // If it's a loop (has trials array), traverse its trials
        if ("trials" in item && Array.isArray(item.trials)) {
          traverse(item.trials);
        }
      });
    };

    traverse(items);
    return allTrials;
  };

  // Memoize all trials to prevent infinite loops in useEffect
  const allTrialsFlattened = useMemo(
    () => getAllTrialsRecursively(trials),
    [trials]
  );

  const allCodes = trials
    .map((item) => {
      if ("parameters" in item) return item.trialCode;
      if ("trials" in item) return item.code;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

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

      const welcome = {
        type: jsPsychHtmlButtonResponse,
        stimulus: "Trial Preview",
        choices: ['View'],
      };

      timeline.push(welcome);

      
      ${!isDevMode && selectedTrial?.trialCode ? selectedTrial?.trialCode : selectedLoop?.code}

    ${isDevMode && allCodes}

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
  }, [selectedTrial, selectedLoop, allTrialsFlattened, isDevMode]);

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
