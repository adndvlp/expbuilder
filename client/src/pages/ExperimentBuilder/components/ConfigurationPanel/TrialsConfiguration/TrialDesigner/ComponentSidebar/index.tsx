import { useEffect, useState } from "react";
import { useExperimentID } from "../../../../../hooks/useExperimentID";
import { ComponentType, TrialComponent } from "../types";
import LeftSideBar from "./LeftSideBar";

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
    y: number,
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

  return (
    <>
      {/* Left Sidebar - Components */}
      {showLeftPanel && (
        <LeftSideBar
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          setComponents={setComponents}
          components={components}
          setLeftPanelWidth={setLeftPanelWidth}
          setShowLeftPanel={setShowLeftPanel}
          isResizingLeft={isResizingLeft}
          leftPanelWidth={leftPanelWidth}
          CANVAS_HEIGHT={CANVAS_HEIGHT}
          CANVAS_WIDTH={CANVAS_WIDTH}
          toJsPsychCoords={toJsPsychCoords}
          images={images}
          audios={audios}
          videos={videos}
          getDefaultConfig={getDefaultConfig}
        />
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
