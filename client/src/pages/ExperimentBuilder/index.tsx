import { ReactNode, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./index.css";
import BuilderWorkspace from "./components/BuilderWorkspace";
import ConfigurationPanel from "./components/ConfigurationPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import ExperimentPreview from "./components/ExperimentPreview";
import GlobalCustomCode from "./components/GlobalCustomCode";
import Timeline from "./components/Timeline";
import { useFileUpload } from "./components/Timeline/useFileUpload";
import useDevMode from "./hooks/useDevMode";
import { usePanelResize } from "./hooks/usePanelResize";
import CanvasStylesProvider from "./providers/CanvasStylesProvider";
import TrialsProvider from "./providers/TrialsProvider";
import UrlProvider from "./providers/UrlProvider";

function ExperimentBuilder() {
  const API_URL = import.meta.env.VITE_API_URL;
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDevMode, setDevMode, isSaveMode, setSaveMode } = useDevMode();
  const panels = usePanelResize();
  const {
    uploadedFiles,
    fileInputRef,
    folderInputRef,
    uploadStatus,
    handleFileUpload,
    handleDeleteFile,
    handleDeleteMultipleFiles,
  } = useFileUpload({ folder: "all" });

  useEffect(() => {
    async function fetchExperiment() {
      const response = await fetch(`${API_URL}/api/experiment/${id}`);
      const data = await response.json();
      if (!response.ok || !data.experiment) navigate("/home");
    }
    fetchExperiment();
  }, [API_URL, id, navigate]);

  return (
    <ErrorBoundary>
      <TrialsProvider>
        <UrlProvider>
          <CanvasStylesProvider experimentID={id}>
            <div className="app-container">
              <div
                style={{
                  position: "fixed",
                  top: 8,
                  left: 16,
                  zIndex: 1000,
                  display: "flex",
                  gap: 8,
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

              {panels.showTimeline && (
                <div
                  className="timeline-container"
                  style={{
                    width: `${panels.timelineWidth}px`,
                    minWidth: 150,
                    position: "relative",
                  }}
                >
                  <div className="timeline-header">Timeline</div>
                  <Timeline
                    uploadedFiles={uploadedFiles}
                    fileInputRef={fileInputRef}
                    folderInputRef={folderInputRef}
                    uploadStatus={uploadStatus}
                    handleFileUpload={handleFileUpload}
                    handleDeleteFile={handleDeleteFile}
                    handleDeleteMultipleFiles={handleDeleteMultipleFiles}
                  />
                  <ResizeHandle
                    side="right"
                    onMouseDown={panels.initResizeTimeline}
                  />
                </div>
              )}

              <BuilderWorkspace
                isDevMode={isDevMode}
                setDevMode={setDevMode}
                isSaveMode={isSaveMode}
                setSaveMode={setSaveMode}
                showTimeline={panels.showTimeline}
                setShowTimeline={panels.setShowTimeline}
                showConfig={panels.showConfig}
                setShowConfig={panels.setShowConfig}
                uploadedFiles={uploadedFiles}
              />

              {panels.showConfig && !isDevMode && (
                <SidePanel
                  width={panels.configWidth}
                  onResize={panels.initResizeConfig}
                >
                  <div style={{ flex: 1, overflowY: "auto", height: "100vh" }}>
                    <ConfigurationPanel />
                  </div>
                </SidePanel>
              )}

              {isDevMode && (
                <SidePanel
                  width={panels.configWidth}
                  onResize={panels.initResizeConfig}
                  column
                >
                  <div
                    className="config-panel-container"
                    style={{
                      width: `${panels.configWidth}px`,
                      minWidth: 150,
                      position: "relative",
                      padding: 15,
                      paddingLeft: 0,
                    }}
                  >
                    <ExperimentPreview uploadedFiles={uploadedFiles} />
                    <GlobalCustomCode />
                  </div>
                </SidePanel>
              )}
            </div>
          </CanvasStylesProvider>
        </UrlProvider>
      </TrialsProvider>
    </ErrorBoundary>
  );
}

function ResizeHandle({
  side,
  onMouseDown,
}: {
  side: "left" | "right";
  onMouseDown: () => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        top: 0,
        [side]: 0,
        width: 2,
        height: "100%",
        cursor: "col-resize",
        background: "#000",
      }}
    />
  );
}

function SidePanel({
  width,
  onResize,
  column = false,
  children,
}: {
  width: number;
  onResize: () => void;
  column?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="config-panel-container"
      style={{
        width: `${width}px`,
        minWidth: 150,
        position: "relative",
        ...(column
          ? { height: "100vh", display: "flex", flexDirection: "column" }
          : {}),
      }}
    >
      {children}
      <ResizeHandle side="left" onMouseDown={onResize} />
    </div>
  );
}

export default ExperimentBuilder;
