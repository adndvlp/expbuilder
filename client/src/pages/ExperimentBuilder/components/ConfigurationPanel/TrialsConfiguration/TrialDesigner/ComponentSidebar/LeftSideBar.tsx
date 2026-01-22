import ResponseComponetsSection from "./ResponseComponetsSection";
import ComponentsSection from "./ComponentsSection";
import { Dispatch, RefObject, SetStateAction, useState } from "react";
import { ComponentType, TrialComponent } from "../types";

type Props = {
  selectedId: string | null;
  isResizingLeft: RefObject<boolean>;
  leftPanelWidth: number;
  setShowLeftPanel: Dispatch<SetStateAction<boolean>>;
  setLeftPanelWidth: Dispatch<SetStateAction<number>>;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  toJsPsychCoords: (
    x: number,
    y: number,
  ) => {
    x: number;
    y: number;
  };
  components: TrialComponent[];
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  images: string[];
  audios: string[];
  videos: string[];
  getDefaultConfig: (_type: ComponentType) => Record<string, any>;
  setComponents: Dispatch<SetStateAction<TrialComponent[]>>;
};

function LeftSideBar({
  isResizingLeft,
  selectedId,
  setSelectedId,
  leftPanelWidth,
  setShowLeftPanel,
  setLeftPanelWidth,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  toJsPsychCoords,
  components,
  images,
  audios,
  videos,
  getDefaultConfig,
  setComponents,
}: Props) {
  const [stimulusExpanded, setStimulusExpanded] = useState(true);

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

  // Add component to canvas
  const addComponent = (type: ComponentType) => {
    const x = CANVAS_WIDTH / 2;
    const y = CANVAS_HEIGHT / 2;

    // Convert to jsPsych coordinates
    const coords = toJsPsychCoords(x, y);

    // Generate name based on existing components of the same type
    let nameCounter = 1;
    let newName = `${type}_${nameCounter}`;
    const existingNames = new Set(components.map((c) => c.config?.name?.value));

    while (existingNames.has(newName)) {
      nameCounter++;
      newName = `${type}_${nameCounter}`;
    }

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
        name: {
          source: "typed",
          value: newName,
        },
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
    { type: "SurveyComponent", label: "Survey" },
    { type: "ButtonResponseComponent", label: "Button" },
    { type: "KeyboardResponseComponent", label: "Keyboard" },
    { type: "SliderResponseComponent", label: "Slider" },
    { type: "InputResponseComponent", label: "Input" },
    { type: "AudioResponseComponent", label: "Audio" },
  ];
  return (
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
                  ].includes(type),
                )
                .map(({ type, label }) => (
                  <ComponentsSection
                    key={type}
                    type={type}
                    label={label}
                    images={images}
                    videos={videos}
                    audios={audios}
                    addComponent={addComponent}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Response Components Section */}
        <ResponseComponetsSection
          componentTypes={componentTypes}
          addComponent={addComponent}
        />
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
        onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
      />
    </div>
  );
}

export default LeftSideBar;
