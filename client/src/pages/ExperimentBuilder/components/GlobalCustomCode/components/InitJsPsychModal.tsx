import { OnMount } from "@monaco-editor/react";
import { createPortal } from "react-dom";
import { ParamDef, Variant } from "../config";
import { EditorTheme } from "../editorConfig";
import InitParamEditors from "./InitParamEditors";
import InitParamTabs from "./InitParamTabs";

type Props = {
  onClose: () => void;
  progressBar: boolean;
  saveIndicator: boolean;
  isLightMode: boolean;
  theme: EditorTheme;
  activeDef: ParamDef;
  activeParam: string;
  setActiveParam: (key: string) => void;
  paramHasCode: (key: string) => boolean;
  editorKey: string;
  currentValue: string;
  isBuilderParam: boolean;
  isBuilderAnyVariant: boolean;
  rightPreviewVariant: Variant;
  setRightPreviewVariant: (variant: Variant) => void;
  getRightValue: (variant: Variant) => string;
  onMount: OnMount;
  onReadonlyMount: OnMount;
  onChange: (value: string) => void;
  editVariant: Variant;
};

export default function InitJsPsychModal(props: Props) {
  const {
    onClose,
    progressBar,
    saveIndicator,
    isLightMode,
    theme,
    activeParam,
    setActiveParam,
    paramHasCode,
    isBuilderParam,
    editVariant,
  } = props;
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "88vw",
          height: "88vh",
          background: theme.editorBg,
          borderRadius: 6,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${theme.borderColor}`,
          boxShadow: "0 16px 56px rgba(0,0,0,0.7)",
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            background: isLightMode ? "#f3f3f3" : "#323233",
            borderBottom: `1px solid ${isLightMode ? "#ddd" : "#2b2b2b"}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isLightMode ? "#444" : "#ccc",
            }}
          >
            initJsPsych {progressBar ? "· progress bar on" : ""}
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "#22c55e",
              fontWeight: 600,
              opacity: saveIndicator ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          >
            ✓ Saved
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              color: isLightMode ? "#666" : "#888",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
        <InitParamTabs
          activeParam={activeParam}
          setActiveParam={setActiveParam}
          paramHasCode={paramHasCode}
          isLightMode={isLightMode}
          theme={theme}
        />
        <InitParamEditors {...props} />
        <div
          style={{
            padding: "4px 14px",
            fontSize: 10,
            color: "#888",
            background: theme.panelHeaderBg,
            borderTop: `1px solid ${theme.borderColor}`,
            flexShrink: 0,
          }}
        >
          {isBuilderParam
            ? `Editing ${editVariant} · ${activeParam}: appended inside function. Right panel shows full generated block.`
            : `Editing ${editVariant} · ${activeParam}: value added as key to initJsPsych({}).`}
        </div>
      </div>
    </div>,
    document.body,
  );
}
