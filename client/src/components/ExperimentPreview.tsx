import { useState } from "react";
import useUrl from "../hooks/useUrl";

function ExperimentPreview() {
  const { experimentUrl } = useUrl();
  const [started, setStarted] = useState(false);
  return (
    <div>
      {!started && (
        <div>
          <div style={{ width: "100%", height: "60vh" }}>
            <iframe
              title="Experiment Preview"
              width="100%"
              height="100%"
              style={{ border: "none" }}
            />
          </div>
          <button
            style={{ width: "100%", borderRadius: "5px" }}
            className="mt-3"
            onClick={() => setStarted(true)}
          >
            Run Demo
          </button>
        </div>
      )}
      {started && (
        <div>
          <div style={{ width: "100%", height: "60vh" }}>
            <iframe
              src={experimentUrl}
              title="Experiment Preview"
              width="100%"
              height="100%"
              style={{ border: "none" }}
            />
          </div>
          <button
            style={{ width: "100%", borderRadius: "5px" }}
            className="mt-3"
            onClick={() => setStarted(false)}
          >
            Stop Demo
          </button>
        </div>
      )}
    </div>
  );
}

export default ExperimentPreview;
