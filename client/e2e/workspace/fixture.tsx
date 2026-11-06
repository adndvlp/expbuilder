import type { ExperimentGraphSnapshot } from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";
declare global {
  interface Window {
    fixtureGraph: ExperimentGraphSnapshot | null;
  }
}
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import TrialsProvider from "../../src/pages/ExperimentBuilder/providers/TrialsProvider";
import useTrials from "../../src/pages/ExperimentBuilder/hooks/useTrials";
import Canvas from "../../src/pages/ExperimentBuilder/components/Canvas";
import "@xyflow/react/dist/style.css";
export function App() {
  const context = useTrials();
  useEffect(() => {
    window.fixtureGraph = context.graph;
  }, [context.graph]);
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas />
    </div>
  );
}
createRoot(document.getElementById("app")!).render(
  <BrowserRouter>
    <Routes>
      <Route
        path="/:id"
        element={
          <TrialsProvider>
            <App />
          </TrialsProvider>
        }
      />
    </Routes>
  </BrowserRouter>,
);
