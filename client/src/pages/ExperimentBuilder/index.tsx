import "./index.css";
import Timeline from "./components/Timeline";
import Canvas from "./components/Canvas";
import ConfigPanel from "./components/ConfigurationPanel";
import TrialsProvider from "./providers/TrialsProvider/TrialsProvider";
import UrlProvider from "./providers/UrlProvider";
import ExperimentPreview from "./components/ExperimentPreview";
import { useEffect, useRef, useState } from "react";
import Switch from "react-switch";
import ErrorBoundary from "./components/ErrorBoundary";
import { FaTimeline } from "react-icons/fa6";
import { PiGearSixBold } from "react-icons/pi";
import { FaHammer } from "react-icons/fa";
import CodeEditor from "./components/CodeEditor";
import useDevMode from "./hooks/useDevMode";
import { useNavigate, useParams } from "react-router-dom";
import { useFileUpload } from "./components/Timeline/useFileUpload";

function ExperimentBuilder() {
  const API_URL = import.meta.env.VITE_API_URL;
  const [showTimeline, setShowTimeline] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  const [timelineWidth, setTimelineWidth] = useState(
    () => window.innerWidth * 0.2,
  );
  const [configWidth, setConfigWidth] = useState(() => window.innerWidth * 0.3);

  const isResizingTimeline = useRef(false);
  const isResizingConfig = useRef(false);

  const { isDevMode, setDevMode } = useDevMode();

  // Shared file upload state between Timeline and TrialsConfig
  const {
    uploadedFiles,
    fileInputRef,
    folderInputRef,
    handleFileUpload,
    handleDeleteFile,
    handleDeleteMultipleFiles,
  } = useFileUpload({ folder: "all" });

  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchExperiment() {
      const res = await fetch(`${API_URL}/api/experiment/${id}`);
      const data = await res.json();
      if (!res.ok || !data.experiment) {
        navigate("/home");
      }
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
            {/* Botones de navegación */}
            <div
              style={{
                position: "fixed",
                top: 8,
                left: 16,
                zIndex: 1000,
                display: "flex",
                gap: "8px",
              }}
            >
              <button
                onClick={() => navigate(-1)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  background: "#3e7d96",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ←
              </button>
            </div>
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
                <Timeline
                  uploadedFiles={uploadedFiles}
                  fileInputRef={fileInputRef}
                  folderInputRef={folderInputRef}
                  handleFileUpload={handleFileUpload}
                  handleDeleteFile={handleDeleteFile}
                  handleDeleteMultipleFiles={handleDeleteMultipleFiles}
                />

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

                <label
                  htmlFor="devMode"
                  className="flex items-center cursor-pointer gap-2"
                  style={{ position: "relative", margin: 0 }}
                >
                  <div style={{ position: "relative", width: 38, height: 18 }}>
                    <Switch
                      id="devMode"
                      checked={isDevMode}
                      onChange={(checked) => setDevMode(checked)}
                      onColor="#f1c40f"
                      onHandleColor="#ffffff"
                      handleDiameter={20}
                      uncheckedIcon={false}
                      checkedIcon={false}
                      height={18}
                      width={38}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: isDevMode ? 20 : 0,
                        top: 2,
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        transition: "left 0.2s",
                      }}
                    >
                      <FaHammer
                        style={{
                          color: isDevMode ? "#f1c40f" : "#888",
                          fontSize: "14px",
                        }}
                      />
                    </span>
                  </div>
                </label>
                {!isDevMode && <ExperimentPreview />}
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
              </div>
              {isDevMode && <CodeEditor />}
              {!isDevMode && (
                <div style={{ overflowY: "auto" }}>
                  <Canvas />
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
                  <ConfigPanel uploadedFiles={uploadedFiles} />
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
