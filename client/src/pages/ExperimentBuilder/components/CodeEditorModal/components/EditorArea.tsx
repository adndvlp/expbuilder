import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { getEditorOptions } from "../editorOptions";
import type { ModalTabDef } from "../types";

type TabMountHandler = (
  tab: ModalTabDef,
) => (
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoInstance: typeof monaco,
) => void;

type EditorAreaProps = {
  activeTabKey: string;
  handleSingleMount: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  handleTabMount: TabMountHandler;
  initialValue?: string;
  isLightMode: boolean;
  language: string;
  readOnly: boolean;
  rightPanelValues: Record<string, string>;
  tabs?: ModalTabDef[];
};

function SplitEditor({
  handleTabMount,
  isLightMode,
  isVisible,
  language,
  liveValue,
  tab,
}: {
  handleTabMount: TabMountHandler;
  isLightMode: boolean;
  isVisible: boolean;
  language: string;
  liveValue: string;
  tab: ModalTabDef;
}) {
  const borderColor = isLightMode ? "#ddd" : "#3c3c3c";
  const panelHeaderBg = isLightMode ? "#f5f5f5" : "#2d2d2d";
  const panelHeaderColor = isLightMode ? "#666" : "#888";
  const rightValue = tab.computeRightPanel!(liveValue);
  const headerStyle = {
    padding: "3px 10px",
    fontSize: 10,
    color: panelHeaderColor,
    background: panelHeaderBg,
    borderBottom: `1px solid ${borderColor}`,
    flexShrink: 0,
  };

  return (
    <div style={{ height: "100%", display: isVisible ? "flex" : "none" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRight: `1px solid ${borderColor}`,
        }}
      >
        <div style={headerStyle}>
          Your code — injected at bottom of function
        </div>
        <div style={{ flex: 1 }}>
          <Editor
            key={`left-${tab.key}`}
            height="100%"
            defaultLanguage={language}
            theme={isLightMode ? "vs-light" : "vs-dark"}
            defaultValue={tab.value}
            onMount={handleTabMount(tab)}
            options={getEditorOptions(false)}
          />
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={headerStyle}>
          {tab.rightPanelHint ??
            "Full generated block — read-only · matches HTML output"}
        </div>
        <div style={{ flex: 1 }}>
          <Editor
            height="100%"
            defaultLanguage={language}
            theme={isLightMode ? "vs-light" : "vs-dark"}
            value={rightValue}
            options={getEditorOptions(true)}
          />
        </div>
      </div>
    </div>
  );
}

export function EditorArea({
  activeTabKey,
  handleSingleMount,
  handleTabMount,
  initialValue,
  isLightMode,
  language,
  readOnly,
  rightPanelValues,
  tabs,
}: EditorAreaProps) {
  return (
    <div style={{ flex: 1, overflow: "hidden" }}>
      {tabs ? (
        tabs.map((tab) => {
          const isVisible = tab.key === activeTabKey;
          if (tab.splitView && tab.computeRightPanel) {
            return (
              <SplitEditor
                key={tab.key}
                handleTabMount={handleTabMount}
                isLightMode={isLightMode}
                isVisible={isVisible}
                language={language}
                liveValue={rightPanelValues[tab.key] ?? tab.value}
                tab={tab}
              />
            );
          }
          return (
            <div
              key={tab.key}
              style={{
                height: "100%",
                display: isVisible ? "block" : "none",
              }}
            >
              <Editor
                key={`single-${tab.key}`}
                height="100%"
                defaultLanguage={language}
                theme={isLightMode ? "vs-light" : "vs-dark"}
                defaultValue={tab.value}
                onMount={handleTabMount(tab)}
                options={getEditorOptions(!tab.onChange)}
              />
            </div>
          );
        })
      ) : (
        <Editor
          height="100%"
          defaultLanguage={language}
          theme={isLightMode ? "vs-light" : "vs-dark"}
          value={initialValue}
          onMount={handleSingleMount}
          options={getEditorOptions(readOnly)}
        />
      )}
    </div>
  );
}
