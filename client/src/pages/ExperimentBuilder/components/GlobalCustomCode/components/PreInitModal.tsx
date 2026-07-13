import Editor, { OnMount } from "@monaco-editor/react";
import { createPortal } from "react-dom";
import { Variant } from "../config";
import { EditorTheme, getEditorOptions } from "../editorConfig";
import { PreviewTabs } from "./PreviewTabs";

type Props = {
  onClose: () => void;
  isLightMode: boolean;
  theme: EditorTheme;
  saveIndicator: boolean;
  editorKey: string;
  currentValue: string;
  editVariant: Variant;
  rightVariant: Variant;
  setRightVariant: (variant: Variant) => void;
  getRightValue: (variant: Variant) => string;
  onMount: OnMount;
  onReadonlyMount: OnMount;
  onChange: (value: string) => void;
};

export default function PreInitModal({
  onClose,
  isLightMode,
  theme,
  saveIndicator,
  editorKey,
  currentValue,
  editVariant,
  rightVariant,
  setRightVariant,
  getRightValue,
  onMount,
  onReadonlyMount,
  onChange,
}: Props) {
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
          height: "82vh",
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
            Before initJsPsych
          </span>
          <span style={{ fontSize: 10, color: theme.panelHeaderColor }}>
            — inside async IIFE, after session setup
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
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRight: `1px solid ${theme.borderColor}`,
            }}
          >
            <div
              style={{
                padding: "3px 10px",
                fontSize: 10,
                color: theme.panelHeaderColor,
                background: theme.panelHeaderBg,
                borderBottom: `1px solid ${theme.borderColor}`,
                flexShrink: 0,
              }}
            >
              Your code — runs before initJsPsych
            </div>
            <div style={{ flex: 1 }}>
              <Editor
                key={editorKey}
                height="100%"
                defaultLanguage="javascript"
                theme={isLightMode ? "vs-light" : "vs-dark"}
                defaultValue={currentValue}
                onMount={onMount}
                onChange={(value) => onChange(value ?? "")}
                options={getEditorOptions(false)}
              />
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <PreviewTabs
              value={rightVariant}
              onChange={setRightVariant}
              isLightMode={isLightMode}
              borderColor={theme.borderColor}
              panelHeaderBg={theme.panelHeaderBg}
              panelHeaderColor={theme.panelHeaderColor}
              hideLabel
            />
            <div style={{ flex: 1 }}>
              <Editor
                key={`preinit-right-${rightVariant}`}
                height="100%"
                defaultLanguage="javascript"
                theme={isLightMode ? "vs-light" : "vs-dark"}
                value={getRightValue(rightVariant)}
                onMount={onReadonlyMount}
                options={getEditorOptions(true)}
              />
            </div>
          </div>
        </div>
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
          Editing {editVariant}. Right panel shows full async IIFE context
          around injection point.
        </div>
      </div>
    </div>,
    document.body,
  );
}
