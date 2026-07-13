import Editor, { OnMount } from "@monaco-editor/react";
import { ParamDef, Variant } from "../config";
import { EditorTheme, getEditorOptions } from "../editorConfig";
import { PreviewTabs } from "./PreviewTabs";

type Props = {
  activeDef: ParamDef;
  activeParam: string;
  editorKey: string;
  currentValue: string;
  isBuilderParam: boolean;
  isBuilderAnyVariant: boolean;
  isLightMode: boolean;
  theme: EditorTheme;
  rightPreviewVariant: Variant;
  setRightPreviewVariant: (variant: Variant) => void;
  getRightValue: (variant: Variant) => string;
  onMount: OnMount;
  onReadonlyMount: OnMount;
  onChange: (value: string) => void;
};

export default function InitParamEditors({
  activeDef,
  activeParam,
  editorKey,
  currentValue,
  isBuilderParam,
  isBuilderAnyVariant,
  isLightMode,
  theme,
  rightPreviewVariant,
  setRightPreviewVariant,
  getRightValue,
  onMount,
  onReadonlyMount,
  onChange,
}: Props) {
  return (
    <>
      <div
        style={{
          padding: "4px 14px",
          fontSize: 10,
          color: "#888",
          background: theme.panelHeaderBg,
          borderBottom: `1px solid ${theme.borderColor}`,
          flexShrink: 0,
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <span>{activeDef.description}</span>
        {isBuilderParam && (
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>
            ⚠ Builder-managed — your code appended inside function
          </span>
        )}
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
            {isBuilderParam
              ? "Your code — injected at bottom of function"
              : "Value — added as param to initJsPsych"}
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
        {isBuilderAnyVariant && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <PreviewTabs
              value={rightPreviewVariant}
              onChange={setRightPreviewVariant}
              isLightMode={isLightMode}
              borderColor={theme.borderColor}
              panelHeaderBg={theme.panelHeaderBg}
              panelHeaderColor={theme.panelHeaderColor}
              hideLabel
            />
            <div style={{ flex: 1 }}>
              <Editor
                key={`right-${activeParam}-${rightPreviewVariant}`}
                height="100%"
                defaultLanguage="javascript"
                theme={isLightMode ? "vs-light" : "vs-dark"}
                value={getRightValue(rightPreviewVariant)}
                onMount={onReadonlyMount}
                options={getEditorOptions(true)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
