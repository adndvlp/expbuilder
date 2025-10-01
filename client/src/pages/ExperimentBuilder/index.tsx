// src/App.tsx
import "./index.css";
import Timeline from "./components/Timeline";
// import Canvas from "./components/Canvas";
import ConfigPanel from "./components/ConfigPanel";
import TrialsProvider from "./providers/TrialsProvider";
import UrlProvider from "./providers/UrlProvider";
import ResultsList from "./components/ResultsList";
import ExperimentPreview from "./components/ExperimentPreview";
import { useEffect, useRef, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { FaTimeline } from "react-icons/fa6";
import { PiGearSixBold } from "react-icons/pi";
import CodeEditor from "./components/CodeEditor";
import useDevMode from "./hooks/useDevMode";
import { useNavigate, useParams } from "react-router-dom";

function ExperimentBuilder() {
  const [showTimeline, setShowTimeline] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  const [timelineWidth, setTimelineWidth] = useState(
    () => window.innerWidth * 0.2
  );
  const [configWidth, setConfigWidth] = useState(() => window.innerWidth * 0.3);

  const isResizingTimeline = useRef(false);
  const isResizingConfig = useRef(false);

  const { isDevMode, setDevMode } = useDevMode();

  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchExperiment() {
      const res = await fetch(`/api/experiment/${id}`);
      const data = await res.json();
      if (!res.ok || !data.experiment) {
        navigate("/home");
      }
      // Si quieres guardar el experimento, hazlo aquí
    }
    fetchExperiment();
  }, [id, navigate]);

  const handleMouseMove = (e: MouseEvent) => {
    if (isResizingTimeline.current) {
      const newWidth = Math.max(0, e.clientX);
      if (newWidth < 250) {
        setShowTimeline(false);
      } else {
        setTimelineWidth(newWidth);
        setShowTimeline(true);
      }
    }

    if (isResizingConfig.current) {
      const newWidth = Math.max(0, window.innerWidth - e.clientX);
      if (newWidth < 400) {
        setShowConfig(false);
      } else {
        setConfigWidth(newWidth);
        setShowConfig(true);
      }
    }
  };

  const stopResizing = () => {
    isResizingTimeline.current = false;
    isResizingConfig.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
  };

  const initResizeTimeline = () => {
    isResizingTimeline.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
  };

  const initResizeConfig = () => {
    isResizingConfig.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
  };

  return (
    <ErrorBoundary>
      <TrialsProvider>
        <UrlProvider>
          <div className="app-container">
            {/* Timeline */}
            {showTimeline && (
              <div
                className="timeline-container"
                style={{
                  width: `${timelineWidth}px`,
                  minWidth: 150,
                  position: "relative",
                }}
              >
                <div className="timeline-header">Timeline</div>
                <Timeline />

                {/* Barra de redimensionamiento derecha */}
                <div
                  onMouseDown={initResizeTimeline}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 2,
                    height: "100%",
                    cursor: "col-resize",
                    background: "#000",
                  }}
                />
              </div>
            )}

            {/* Centro */}
            <div className="canvas-container">
              <div className="canvas-header grid grid-cols-3 gap-4 items-center">
                {!showTimeline && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "6.2%",
                      transform: "translateY(-50%)",
                      background: "#3d92b4",
                      color: "white",
                      borderRadius: "0 4px 4px 0",
                      cursor: "pointer",
                      padding: "4px 8px",
                      zIndex: 10,
                    }}
                    onClick={() => setShowTimeline(true)}
                  >
                    <FaTimeline />
                  </div>
                )}
                Preview
                {!showConfig && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "6.2%",
                      transform: "translateY(-50%)",
                      background: "#3d92b4",
                      color: "white",
                      borderRadius: "0 4px 4px 0",
                      cursor: "pointer",
                      padding: "4px 8px",
                      zIndex: 10,
                    }}
                    onClick={() => setShowConfig(true)}
                  >
                    <PiGearSixBold />
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <label
                    htmlFor="devMode"
                    className="flex items-center cursor-pointer"
                  >
                    DevMode
                    <input
                      id="devMode"
                      type="checkbox"
                      checked={isDevMode}
                      onChange={(e) => setDevMode(e.target.checked)}
                      className="ml-2 h-4 w-4 cursor-pointer"
                    ></input>
                  </label>
                </div>
              </div>
              {isDevMode && <CodeEditor />}
              {!isDevMode && (
                <div style={{ overflowY: "auto" }}>
                  <ExperimentPreview />
                  <ResultsList />
                </div>
              )}
            </div>

            {/* Config Panel */}
            {showConfig && !isDevMode && (
              <div
                className="config-panel-container"
                style={{
                  width: `${configWidth}px`,
                  minWidth: 150,
                  position: "relative",
                }}
              >
                {/* Contenido con scroll */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    height: "100vh",
                  }}
                >
                  <ConfigPanel />
                </div>

                {/* Barra de redimensionamiento izquierda */}
                <div
                  onMouseDown={initResizeConfig}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 2,
                    height: "100%",
                    cursor: "col-resize",
                    background: "#000",
                  }}
                />
              </div>
            )}

            {isDevMode && (
              <div
                className="config-panel-container"
                style={{
                  width: `${configWidth}px`,
                  minWidth: 150,
                  position: "relative",
                  height: "100vh", // Altura definida
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  className="config-panel-container"
                  style={{
                    width: `${configWidth}px`,
                    minWidth: 150,
                    position: "relative",
                    padding: "15px",
                    paddingLeft: "0px",
                  }}
                >
                  <ExperimentPreview />
                </div>

                {/* Barra de redimensionamiento izquierda */}
                <div
                  onMouseDown={initResizeConfig}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 2,
                    height: "100%",
                    cursor: "col-resize",
                    background: "#000",
                  }}
                />
              </div>
            )}
          </div>
        </UrlProvider>
      </TrialsProvider>
    </ErrorBoundary>
  );
}

export default ExperimentBuilder;
