import { useEffect, useState, useRef } from "react";
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

type CanvasStylesProp = {
  backgroundColor?: string;
  width?: number;
  height?: number;
};

type Props = {
  uploadedFiles?: UploadedFile[];
  canvasStyles?: CanvasStylesProp;
  autoStart?: boolean;
};

function ExperimentPreview({
  uploadedFiles = [],
  canvasStyles,
  autoStart = false,
}: Props) {
  const { generateLocalExperiment } = useExperimentCode(uploadedFiles);
  const { trialUrl } = useUrl();
  const { version, incrementVersion } = useExperimentState();
  const [started, setStarted] = useState(autoStart);
  const [key, setKey] = useState(autoStart ? 1 : 0);

  const { isDevMode, code } = useDevMode();

  const experimentID = useExperimentID();

  // Scale iframe to fit container while keeping internal vw/vh correct
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!canvasStyles?.width || !canvasStyles?.height) return;
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const scaleX = el.clientWidth / canvasStyles.width!;
      const scaleY = el.clientHeight / canvasStyles.height!;
      setScale(Math.min(scaleX, scaleY, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasStyles?.width, canvasStyles?.height, started]);

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
      if (isDevMode || (!selectedTrial && !selectedLoop)) {
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
        body: JSON.stringify({ generatedCode: code, canvasStyles }),
        credentials: "include",
        mode: "cors",
      });
      incrementVersion();
    };

    generateAndSendCode();
  }, [
    code,
    isDevMode,
    selectedTrial,
    selectedLoop,
    experimentID,
    canvasStyles,
  ]);

  // Crear URL con parámetros únicos para evitar caché

  return (
    <div
      style={
        autoStart
          ? { display: "flex", flexDirection: "column", height: "100%" }
          : undefined
      }
    >
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
        <div
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          {!autoStart && (
            <button
              style={{ width: "100%", borderRadius: "5px" }}
              onClick={handleStop}
            >
              Stop Demo
            </button>
          )}
          <div
            ref={wrapperRef}
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              background: "var(--neutral-light, #e5e7eb)",
            }}
          >
            <iframe
              key={key}
              src={trialUrl}
              title="Experiment Preview"
              style={{
                border: "none",
                width: canvasStyles?.width ? `${canvasStyles.width}px` : "100%",
                height: canvasStyles?.height
                  ? `${canvasStyles.height}px`
                  : "60vh",
                flexShrink: 0,
                transform: `scale(${scale})`,
                transformOrigin: "center center",
                boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                background: canvasStyles?.backgroundColor || "transparent",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ExperimentPreview;
