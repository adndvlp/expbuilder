import { useEffect, useState } from "react";
import useUrl from "../hooks/useUrl";
import { useExperimentState } from "../hooks/useExpetimentState";
import useTrials from "../hooks/useTrials";
import { useExperimentID } from "../hooks/useExperimentID";
import {
  generateSingleTrialCode,
  generateSingleLoopCode,
} from "../utils/generateTrialLoopCodes";
import useDevMode from "../hooks/useDevMode";
import { useExperimentCode } from "./Timeline/ExperimentCode/useExperimentCode";
const API_URL = import.meta.env.VITE_API_URL;

type UploadedFile = { name: string; url: string; type: string };

type Props = {
  uploadedFiles?: UploadedFile[];
};

function ExperimentPreview({ uploadedFiles = [] }: Props) {
  const { generateLocalExperiment } = useExperimentCode(uploadedFiles);
  const { trialUrl } = useUrl();
  const { version, incrementVersion } = useExperimentState();
  const [started, setStarted] = useState(false);
  const [key, setKey] = useState(0);

  const { isDevMode } = useDevMode();

  const experimentID = useExperimentID();

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

  const { selectedTrial, selectedLoop, getTrial, getLoopTimeline, getLoop } =
    useTrials();

  // trials preview - generate code dynamically
  useEffect(() => {
    let code = "";
    const generateAndSendCode = async () => {
      if (isDevMode) {
        code = await generateLocalExperiment();
      } else {
        if (!selectedTrial && !selectedLoop) return;

        let generatedCode = "";

        if (selectedTrial) {
          generatedCode = await generateSingleTrialCode(
            selectedTrial,
            uploadedFiles,
            experimentID || "",
            getTrial,
          );
        } else if (selectedLoop) {
          generatedCode = await generateSingleLoopCode(
            selectedLoop,
            experimentID || "",
            uploadedFiles,
            getTrial,
            getLoopTimeline,
            getLoop,
          );
        }

        if (!generatedCode) return;

        const trialCode = `

        const trialSessionId =
            "${selectedTrial?.name || selectedLoop?.name}_result_" + (crypto.randomUUID
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
      
      ${generatedCode}

      jsPsych.run(timeline);
      
      })()
      `;
        code = trialCode;
      }

      await fetch(`${API_URL}/api/trials-preview/${experimentID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedCode: code }),
        credentials: "include",
        mode: "cors",
      });
      incrementVersion();
    };

    generateAndSendCode();
  }, [isDevMode, selectedTrial, selectedLoop, experimentID]);

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
