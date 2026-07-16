import { ReactNode } from "react";
import { FaHammer, FaSave } from "react-icons/fa";
import { FaTimeline } from "react-icons/fa6";
import { PiGearSixBold } from "react-icons/pi";
import Switch from "react-switch";
import { UploadedFile } from "./Timeline/useFileUpload";
import Canvas from "./Canvas";
import CodeEditor from "./CodeEditor";
import ExperimentPreview from "./ExperimentPreview";

type Props = {
  isDevMode: boolean;
  setDevMode: (value: boolean) => void;
  isSaveMode: boolean;
  setSaveMode: (value: boolean) => void;
  showTimeline: boolean;
  setShowTimeline: (value: boolean) => void;
  showConfig: boolean;
  setShowConfig: (value: boolean) => void;
  uploadedFiles: UploadedFile[];
};

function ModeToggle({
  id,
  checked,
  onChange,
  color,
  icon,
  title,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  color: string;
  icon: ReactNode;
  title?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center cursor-pointer gap-2"
      style={{ position: "relative", margin: 0 }}
      title={title}
    >
      <div style={{ position: "relative", width: 38, height: 18 }}>
        <Switch
          id={id}
          checked={checked}
          onChange={onChange}
          onColor={color}
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
            left: checked ? 20 : 0,
            top: 2,
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            transition: "left 0.2s",
            color: checked ? color : "#888",
            fontSize: 14,
          }}
        >
          {icon}
        </span>
      </div>
    </label>
  );
}

export default function BuilderWorkspace({
  isDevMode,
  setDevMode,
  isSaveMode,
  setSaveMode,
  showTimeline,
  setShowTimeline,
  showConfig,
  setShowConfig,
  uploadedFiles,
}: Props) {
  return (
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
        <ModeToggle
          id="devMode"
          checked={isDevMode}
          onChange={setDevMode}
          color="#f1c40f"
          icon={<FaHammer />}
        />
        <ModeToggle
          id="saveMode"
          checked={isSaveMode}
          onChange={setSaveMode}
          color="#22c55e"
          icon={<FaSave />}
          title={isSaveMode ? "Save results: ON" : "Save results: OFF"}
        />
        {!isDevMode && <ExperimentPreview uploadedFiles={uploadedFiles} />}
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
      {isDevMode ? (
        <CodeEditor />
      ) : (
        <div className="canvas-content">
          <Canvas />
        </div>
      )}
    </div>
  );
}
