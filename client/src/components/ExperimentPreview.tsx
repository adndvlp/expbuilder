import { useEffect, useState } from "react";
import useUrl from "../hooks/useUrl";
import { useExperimentState } from "../hooks/useExpetimentState";
import useTrials from "../hooks/useTrials";

function ExperimentPreview() {
  const { trialUrl } = useUrl();
  const { version, incrementVersion } = useExperimentState();
  const [started, setStarted] = useState(false);
  const [key, setKey] = useState(0);

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

  const { selectedTrial, trials } = useTrials();

  // trials preview
  useEffect(() => {
    if (selectedTrial && selectedTrial.trialCode) {
      const trialCode = `
      const jsPsych = initJsPsych({
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

      ${selectedTrial?.trialCode}

      jsPsych.run(timeline);`;

      (async () => {
        await fetch("/api/trials-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generatedCode: trialCode }),
          credentials: "include",
          mode: "cors",
        });
        incrementVersion();
      })();
    }
  }, [selectedTrial, trials]);

  // Crear URL con parámetros únicos para evitar caché

  return (
    <div>
      {!started && (
        <div>
          <button
            style={{ width: "100%", borderRadius: "5px" }}
            className="mt-3"
            onClick={handleStart}
          >
            Run Demo
          </button>
        </div>
      )}
      {started && (
        <div>
          <div style={{ width: "100%", height: "60vh" }}>
            <iframe
              key={key}
              src={trialUrl}
              title="Experiment Preview"
              width="100%"
              height="100%"
              style={{ border: "none" }}
            />
          </div>
          <button
            style={{ width: "100%", borderRadius: "5px" }}
            className="mt-3"
            onClick={handleStop}
          >
            Stop Demo
          </button>
        </div>
      )}
    </div>
  );
}

export default ExperimentPreview;
