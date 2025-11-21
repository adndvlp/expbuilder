import { useEffect, useState } from "react";
import { useExperimentID } from "../../../../hooks/useExperimentID";
import { ComponentType, TrialComponent } from "./types";

const API_URL = import.meta.env.VITE_API_URL;
type Props = {
  setLeftPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  leftPanelWidth: number;
  setShowLeftPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showLeftPanel: boolean;
  isResizingLeft: React.RefObject<boolean>;
  isOpen: boolean;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  toJsPsychCoords: (
    x: number,
    y: number
  ) => {
    x: number;
    y: number;
  };
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  getDefaultConfig: (_type: ComponentType) => Record<string, any>;
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  components: TrialComponent[];
};

function ComponentSidebar({
  showLeftPanel,
  setShowLeftPanel,
  leftPanelWidth,
  setLeftPanelWidth,
  isResizingLeft,
  isOpen,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  toJsPsychCoords,
  setComponents,
  getDefaultConfig,
  selectedId,
  setSelectedId,
  components,
}: Props) {
  const experimentID = useExperimentID();

  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [audios, setAudios] = useState<string[]>([]);
  // resize
  const [stimulusExpanded, setStimulusExpanded] = useState(true);
  const [responseExpanded, setResponseExpanded] = useState(true);
  const [surveyExpanded, setSurveyExpanded] = useState(true);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [audioExpanded, setAudioExpanded] = useState(false);

  const initResizeLeft = () => {
    isResizingLeft.current = true;
    document.addEventListener("mousemove", (e) => {
      if (isResizingLeft.current) {
        const newWidth = Math.max(0, e.clientX - 20);
        if (newWidth < 200) {
          setShowLeftPanel(false);
        } else {
          setLeftPanelWidth(newWidth);
          setShowLeftPanel(true);
        }
      }
    });
    document.addEventListener("mouseup", () => {
      isResizingLeft.current = false;
    });
  };

  // Fetch media files when modal opens
  useEffect(() => {
    if (isOpen && experimentID) {
      // Fetch images
      fetch(`${API_URL}/api/list-files/img/${experimentID}`)
        .then((res) => res.json())
        .then((data) => setImages(data.files?.map((f: any) => f.url) || []))
        .catch((err) => console.error("Error loading images:", err));

      // Fetch videos
      fetch(`${API_URL}/api/list-files/vid/${experimentID}`)
        .then((res) => res.json())
        .then((data) => setVideos(data.files?.map((f: any) => f.url) || []))
        .catch((err) => console.error("Error loading videos:", err));

      // Fetch audios
      fetch(`${API_URL}/api/list-files/aud/${experimentID}`)
        .then((res) => res.json())
        .then((data) => setAudios(data.files?.map((f: any) => f.url) || []))
        .catch((err) => console.error("Error loading audios:", err));
    }
  }, [isOpen, experimentID]);

  // Add component to canvas
  const addComponent = (type: ComponentType) => {
    const x = CANVAS_WIDTH / 2;
    const y = CANVAS_HEIGHT / 2;

    // Convert to jsPsych coordinates
    const coords = toJsPsychCoords(x, y);

    // Determine default dimensions based on component type
    let width = 200;
    let height = 50;

    if (type === "ImageComponent" || type === "VideoComponent") {
      width = 300;
      height = 300;
    } else if (type === "SliderResponseComponent") {
      width = 250;
      height = 100;
    } else if (type === "SketchpadComponent") {
      width = 200;
      height = 200;
    }

    const newComponent: TrialComponent = {
      id: `${type}-${Date.now()}`,
      type,
      x,
      y,
      width,
      height,
      config: {
        ...getDefaultConfig(type),
        coordinates: {
          source: "typed",
          value: coords,
        },
      },
    };

    setComponents((prev) => [...prev, newComponent]);
    setSelectedId(newComponent.id);
  };

  // Handle delete
  const handleDelete = () => {
    if (selectedId) {
      setComponents(components.filter((comp) => comp.id !== selectedId));
      setSelectedId(null);
    }
  };

  const componentTypes: { type: ComponentType; label: string }[] = [
    { type: "ImageComponent", label: "Image" },
    { type: "VideoComponent", label: "Video" },
    { type: "AudioComponent", label: "Audio" },
    { type: "HtmlComponent", label: "HTML" },
    { type: "SketchpadComponent", label: "Sketchpad" },
    { type: "ButtonResponseComponent", label: "Button" },
    { type: "KeyboardResponseComponent", label: "Keyboard" },
    { type: "SliderResponseComponent", label: "Slider" },
    { type: "InputResponseComponent", label: "Input" },
    { type: "SurveyTextComponent", label: "Survey Text" },
    { type: "SurveyComponent", label: "SurveyJS" },
  ];
  return (
    <>
      {/* Left Sidebar - Components */}
      {showLeftPanel && (
        <div
          style={{
            width: `${leftPanelWidth}px`,
            borderRight: "2px solid var(--neutral-mid)",
            display: "flex",
            flexDirection: "column",
            background: "var(--neutral-light)",
            position: "relative",
            height: "100%",
          }}
        >
          <h3
            style={{
              margin: "0",
              padding: "12px 16px",
              fontSize: "16px",
              fontWeight: 700,
              background: "var(--light-blue)",
              borderBottom: "2px solid var(--neutral-mid)",
              color: "var(--text-light)",
            }}
          >
            Components
          </h3>

          {/* Components list with inline media */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {/* Stimulus Components Section */}
            <div style={{ marginBottom: "12px" }}>
              <button
                onClick={() => setStimulusExpanded(!stimulusExpanded)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span>Stimulus</span>
                <span>{stimulusExpanded ? "▼" : "▶"}</span>
              </button>
              {stimulusExpanded && (
                <div style={{ paddingLeft: "4px" }}>
                  {componentTypes
                    .filter(({ type }) =>
                      [
                        "ImageComponent",
                        "VideoComponent",
                        "AudioComponent",
                        "HtmlComponent",
                        "SketchpadComponent",
                      ].includes(type)
                    )
                    .map(({ type, label }) => (
                      <div key={type}>
                        {/* Image Component with dropdown style */}
                        {type === "ImageComponent" && (
                          <>
                            <button
                              onClick={() => setImageExpanded(!imageExpanded)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                background:
                                  "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
                                color: "#1e40af",
                                border: "1px solid #93c5fd",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: 600,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "8px",
                              }}
                            >
                              <span>{label}</span>
                              <span>{imageExpanded ? "▼" : "▶"}</span>
                            </button>
                            {imageExpanded && (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "6px",
                                  marginBottom: "12px",
                                  padding: "8px",
                                  background: "var(--neutral-light)",
                                  borderRadius: "4px",
                                }}
                              >
                                {images.length === 0 ? (
                                  <p
                                    style={{
                                      gridColumn: "1 / -1",
                                      textAlign: "center",
                                      color: "#9ca3af",
                                      fontSize: "11px",
                                      margin: 0,
                                    }}
                                  >
                                    No images
                                  </p>
                                ) : (
                                  images.map((imgUrl, idx) => (
                                    <div
                                      key={idx}
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData(
                                          "fileUrl",
                                          imgUrl
                                        );
                                        e.dataTransfer.setData(
                                          "type",
                                          "ImageComponent"
                                        );
                                      }}
                                      style={{
                                        cursor: "grab",
                                        border: "1px solid #ddd",
                                        borderRadius: "4px",
                                        overflow: "hidden",
                                        aspectRatio: "1",
                                      }}
                                    >
                                      <img
                                        src={`${API_URL}/${imgUrl}`}
                                        alt="thumbnail"
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Video Component with dropdown style */}
                        {type === "VideoComponent" && (
                          <>
                            <button
                              onClick={() => setVideoExpanded(!videoExpanded)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                background:
                                  "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
                                color: "#1e40af",
                                border: "1px solid #93c5fd",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: 600,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "8px",
                              }}
                            >
                              <span>{label}</span>
                              <span>{videoExpanded ? "▼" : "▶"}</span>
                            </button>
                            {videoExpanded && (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "6px",
                                  marginBottom: "12px",
                                  padding: "8px",
                                  background: "var(--neutral-light)",
                                  borderRadius: "4px",
                                }}
                              >
                                {videos.length === 0 ? (
                                  <p
                                    style={{
                                      gridColumn: "1 / -1",
                                      textAlign: "center",
                                      color: "#9ca3af",
                                      fontSize: "11px",
                                      margin: 0,
                                    }}
                                  >
                                    No videos
                                  </p>
                                ) : (
                                  videos.map((vidUrl, idx) => (
                                    <div
                                      key={idx}
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData(
                                          "fileUrl",
                                          vidUrl
                                        );
                                        e.dataTransfer.setData(
                                          "type",
                                          "VideoComponent"
                                        );
                                      }}
                                      style={{
                                        cursor: "grab",
                                        border: "1px solid #ddd",
                                        borderRadius: "4px",
                                        overflow: "hidden",
                                        aspectRatio: "16/9",
                                        background: "#000",
                                        position: "relative",
                                      }}
                                    >
                                      <video
                                        src={`${API_URL}/${vidUrl}`}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                      <div
                                        style={{
                                          position: "absolute",
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          background: "rgba(0,0,0,0.7)",
                                          color: "white",
                                          fontSize: "9px",
                                          padding: "2px 4px",
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {vidUrl.split("/").pop()}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Audio Component with dropdown style */}
                        {type === "AudioComponent" && (
                          <>
                            <button
                              onClick={() => setAudioExpanded(!audioExpanded)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                background:
                                  "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
                                color: "#1e40af",
                                border: "1px solid #93c5fd",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: 600,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "8px",
                              }}
                            >
                              <span>{label}</span>
                              <span>{audioExpanded ? "▼" : "▶"}</span>
                            </button>
                            {audioExpanded && (
                              <div
                                style={{
                                  marginBottom: "12px",
                                  padding: "8px",
                                  background: "var(--neutral-light)",
                                  borderRadius: "4px",
                                }}
                              >
                                {audios.length === 0 ? (
                                  <p
                                    style={{
                                      textAlign: "center",
                                      color: "#9ca3af",
                                      fontSize: "11px",
                                      margin: 0,
                                    }}
                                  >
                                    No audio
                                  </p>
                                ) : (
                                  audios.map((audUrl, idx) => (
                                    <div
                                      key={idx}
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData(
                                          "fileUrl",
                                          audUrl
                                        );
                                        e.dataTransfer.setData(
                                          "type",
                                          "AudioComponent"
                                        );
                                      }}
                                      style={{
                                        padding: "8px",
                                        border: "1px solid var(--neutral-mid)",
                                        borderRadius: "4px",
                                        cursor: "grab",
                                        background: "var(--neutral-light)",
                                        fontSize: "11px",
                                        marginBottom: "4px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        color: "var(--text-dark)",
                                      }}
                                    >
                                      <span style={{ fontSize: "16px" }}>
                                        🎵
                                      </span>
                                      <span
                                        style={{
                                          flex: 1,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {audUrl.split("/").pop()}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Other stimulus components without dropdown */}
                        {type !== "ImageComponent" &&
                          type !== "VideoComponent" &&
                          type !== "AudioComponent" && (
                            <button
                              onClick={() => addComponent(type)}
                              style={{
                                width: "100%",
                                padding: "12px 16px",
                                border: "2px solid #d1d5db",
                                borderRadius: "8px",
                                background: "white",
                                cursor: "pointer",
                                textAlign: "left",
                                fontSize: "15px",
                                fontWeight: 600,
                                color: "#374151",
                                transition: "all 0.2s",
                                marginBottom: "10px",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = "#f3f4f6";
                                e.currentTarget.style.borderColor = "#9ca3af";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = "white";
                                e.currentTarget.style.borderColor = "#d1d5db";
                              }}
                            >
                              {label}
                            </button>
                          )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Response Components Section */}
            <div style={{ marginBottom: "12px" }}>
              <button
                onClick={() => setResponseExpanded(!responseExpanded)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#9333ea",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span>Response</span>
                <span>{responseExpanded ? "▼" : "▶"}</span>
              </button>
              {responseExpanded && (
                <div style={{ paddingLeft: "4px" }}>
                  {componentTypes
                    .filter(({ type }) =>
                      [
                        "ButtonResponseComponent",
                        "KeyboardResponseComponent",
                        "SliderResponseComponent",
                        "InputResponseComponent",
                      ].includes(type)
                    )
                    .map(({ type, label }) => (
                      <div key={type}>
                        <button
                          onClick={() => addComponent(type)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            border: "2px solid #d1d5db",
                            borderRadius: "8px",
                            background: "white",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "#374151",
                            transition: "all 0.2s",
                            marginBottom: "10px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = "#f3f4f6";
                            e.currentTarget.style.borderColor = "#9ca3af";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.borderColor = "#d1d5db";
                          }}
                        >
                          {label}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Survey Components Section */}
            <div style={{ marginBottom: "12px" }}>
              <button
                onClick={() => setSurveyExpanded(!surveyExpanded)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#f59e0b",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span>Survey</span>
                <span>{surveyExpanded ? "▼" : "▶"}</span>
              </button>
              {surveyExpanded && (
                <div style={{ paddingLeft: "4px" }}>
                  {componentTypes
                    .filter(({ type }) =>
                      ["SurveyTextComponent", "SurveyComponent"].includes(type)
                    )
                    .map(({ type, label }) => (
                      <div key={type}>
                        <button
                          onClick={() => addComponent(type)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            border: "2px solid #d1d5db",
                            borderRadius: "8px",
                            background: "white",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "#374151",
                            transition: "all 0.2s",
                            marginBottom: "10px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = "#f3f4f6";
                            e.currentTarget.style.borderColor = "#9ca3af";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.borderColor = "#d1d5db";
                          }}
                        >
                          {label}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Delete button at bottom */}
          {selectedId && (
            <div style={{ padding: "10px", borderTop: "1px solid #ddd" }}>
              <button
                onClick={handleDelete}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Delete Selected
              </button>
            </div>
          )}

          {/* Resize handle */}
          <div
            onMouseDown={initResizeLeft}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 4,
              height: "100%",
              cursor: "col-resize",
              background: "transparent",
              zIndex: 10,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#000")}
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          />
        </div>
      )}

      {/* Toggle button for left panel */}
      {!showLeftPanel && (
        <button
          onClick={() => setShowLeftPanel(true)}
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--primary-blue)",
            color: "var(--text-light)",
            border: "none",
            borderRadius: "0 8px 8px 0",
            padding: "16px 8px",
            cursor: "pointer",
            zIndex: 20,
            fontSize: "18px",
            fontWeight: "bold",
          }}
        >
          ›
        </button>
      )}
    </>
  );
}

export default ComponentSidebar;
