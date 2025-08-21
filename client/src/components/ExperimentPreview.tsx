import { useEffect, useState } from "react";
import useUrl from "../hooks/useUrl";
import { useExperimentState } from "../hooks/useExpetimentState";

function ExperimentPreview() {
  const { trialUrl } = useUrl();
  const { version } = useExperimentState();
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
