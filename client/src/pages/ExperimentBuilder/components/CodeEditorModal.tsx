import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { setupMonacoJsPsychContext } from "./monacoJsPsychContext";

export type ModalTabDef = {
  key: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  hint?: string;
  isBuilderManaged?: boolean;
  // Split view: left = editable user code, right = readonly generated preview
  splitView?: boolean;
  computeRightPanel?: (userCode: string) => string;
  rightPanelHint?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  language?: string;
  // Single editor mode:
  initialValue?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  hint?: string;
  // Multi-tab mode (takes priority):
  tabs?: ModalTabDef[];
};

export default function CodeEditorModal({
  isOpen,
  onClose,
  title,
  language = "javascript",
  initialValue,
  onChange,
  readOnly = false,
  hint,
  tabs,
}: Props) {
  const [isLightMode] = useState(
    window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false,
  );

  // Multi-tab state
  const [activeTabKey, setActiveTabKey] = useState<string>(tabs?.[0]?.key ?? "");
  // Right-panel live values — updated on keystroke, only drives the readonly right panel.
  // Left (editable) editors are uncontrolled (defaultValue + key) so they never lose cursor.
  const [rightPanelValues, setRightPanelValues] = useState<Record<string, string>>({});

  // Single-editor ref
  const singleEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // Per-tab debounce timers for onChange
  const onChangeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isMultiTab = !!tabs && tabs.length > 0;

  // Init right-panel values when modal opens
  useEffect(() => {
    if (isOpen && isMultiTab && tabs) {
      setRightPanelValues(Object.fromEntries(tabs.map((t) => [t.key, t.value])));
      setActiveTabKey(tabs[0]?.key ?? "");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync single editor on open
  useEffect(() => {
    if (!isOpen || isMultiTab) return;
    const editor = singleEditorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (model && model.getValue() !== (initialValue ?? "")) {
      model.setValue(initialValue ?? "");
    }
  }, [isOpen, initialValue, isMultiTab]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSingleMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    singleEditorRef.current = editor;
    if (!readOnly && onChange) {
      editor.onDidChangeModelContent(() => onChange(editor.getValue()));
    }
  };

  const handleTabMount =
    (tab: ModalTabDef) =>
    (editor: monaco.editor.IStandaloneCodeEditor, monacoInst: typeof monaco) => {
      setupMonacoJsPsychContext(monacoInst);
      if (tab.onChange) {
        editor.onDidChangeModelContent(() => {
          const val = editor.getValue();
          // Update right-panel preview immediately (no save)
          setRightPanelValues((prev) => ({ ...prev, [tab.key]: val }));
          // Debounce the actual save (1 s) — same pattern as other trial fields
          clearTimeout(onChangeTimers.current[tab.key]);
          onChangeTimers.current[tab.key] = setTimeout(() => {
            tab.onChange!(val);
          }, 1000);
        });
      }
    };

  const editorOptions = (readOnly: boolean) => ({
    readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineNumbers: "on" as const,
    tabSize: 2,
    wordWrap: "on" as const,
    folding: true,
    glyphMargin: readOnly,
    fixedOverflowWidgets: true,
    suggest: !readOnly
      ? { showKeywords: true, showFunctions: true, showVariables: true }
      : undefined,
    quickSuggestions: !readOnly ? { other: true, strings: true } : false,
  });

  const tabBg = isLightMode ? "#ececec" : "#252526";
  const activeTabBg = isLightMode ? "#ffffff" : "#1e1e1e";
  const inactiveColor = isLightMode ? "#666" : "#888";
  const activeColor = isLightMode ? "#222" : "#ccc";

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "82vw", height: "82vh",
          background: isLightMode ? "#fff" : "#1e1e1e",
          borderRadius: 6, overflow: "hidden",
          display: "flex", flexDirection: "column",
          border: `1px solid ${isLightMode ? "#ddd" : "#3c3c3c"}`,
          boxShadow: "0 16px 56px rgba(0,0,0,0.7)",
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 14px",
            background: isLightMode ? "#f3f3f3" : "#323233",
            borderBottom: `1px solid ${isLightMode ? "#ddd" : "#2b2b2b"}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: isLightMode ? "#444" : "#ccc" }}>
            {title}
          </span>
          {!isMultiTab && hint && (
            <span style={{ fontSize: 10, color: "#888", flex: 1 }}>{hint}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto", background: "none", border: "none",
              cursor: "pointer", fontSize: 20, lineHeight: 1,
              color: isLightMode ? "#666" : "#888", padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* VS Code tab strip */}
        {isMultiTab && (
          <div
            style={{
              display: "flex",
              background: tabBg,
              borderBottom: `1px solid ${isLightMode ? "#ddd" : "#1e1e1e"}`,
              overflowX: "auto",
              flexShrink: 0,
            }}
          >
            {tabs!.map((tab) => {
              const isActive = tab.key === activeTabKey;
              const isReadOnly = !tab.onChange;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTabKey(tab.key)}
                  title={tab.hint}
                  style={{
                    padding: "7px 16px",
                    border: "none",
                    borderTop: isActive
                      ? `2px solid ${tab.isBuilderManaged ? "#f59e0b" : isReadOnly ? "#888" : "#3d92b4"}`
                      : "2px solid transparent",
                    borderRight: `1px solid ${isLightMode ? "#ddd" : "#1e1e1e"}`,
                    background: isActive ? activeTabBg : "transparent",
                    color: isActive ? activeColor : inactiveColor,
                    fontSize: 12,
                    fontWeight: isActive ? 500 : 400,
                    fontStyle: isReadOnly ? "italic" : "normal",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background 0.1s",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {tab.label}
                  {tab.isBuilderManaged && (
                    <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>bld</span>
                  )}
                  {isReadOnly && (
                    <span style={{ fontSize: 9, opacity: 0.6 }}>read-only</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Editor area */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {isMultiTab ? (
            tabs!.map((tab) => {
              const isVisible = tab.key === activeTabKey;
              if (tab.splitView && tab.computeRightPanel) {
                const liveVal = rightPanelValues[tab.key] ?? tab.value;
                const rightVal = tab.computeRightPanel(liveVal);
                const borderColor = isLightMode ? "#ddd" : "#3c3c3c";
                const panelHeaderBg = isLightMode ? "#f5f5f5" : "#2d2d2d";
                const panelHeaderColor = isLightMode ? "#666" : "#888";
                return (
                  <div
                    key={tab.key}
                    style={{ height: "100%", display: isVisible ? "flex" : "none" }}
                  >
                    {/* Left: editable — uncontrolled to preserve cursor */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: `1px solid ${borderColor}` }}>
                      <div style={{ padding: "3px 10px", fontSize: 10, color: panelHeaderColor, background: panelHeaderBg, borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
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
                          options={editorOptions(false)}
                        />
                      </div>
                    </div>
                    {/* Right: readonly full preview */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ padding: "3px 10px", fontSize: 10, color: panelHeaderColor, background: panelHeaderBg, borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
                        {tab.rightPanelHint ?? "Full generated block — read-only · matches HTML output"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Editor
                          height="100%"
                          defaultLanguage={language}
                          theme={isLightMode ? "vs-light" : "vs-dark"}
                          value={rightVal}
                          options={editorOptions(true)}
                        />
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={tab.key}
                  style={{ height: "100%", display: isVisible ? "block" : "none" }}
                >
                  <Editor
                    key={`single-${tab.key}`}
                    height="100%"
                    defaultLanguage={language}
                    theme={isLightMode ? "vs-light" : "vs-dark"}
                    defaultValue={tab.value}
                    onMount={handleTabMount(tab)}
                    options={editorOptions(!tab.onChange)}
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
              options={editorOptions(readOnly)}
            />
          )}
        </div>

        {/* Hint bar (multi-tab active hint) */}
        {isMultiTab && (() => {
          const activeTab = tabs!.find((t) => t.key === activeTabKey);
          return activeTab?.hint ? (
            <div
              style={{
                padding: "4px 14px",
                fontSize: 10, color: "#888",
                background: isLightMode ? "#f3f3f3" : "#252526",
                borderTop: `1px solid ${isLightMode ? "#ddd" : "#2b2b2b"}`,
                flexShrink: 0,
              }}
            >
              {activeTab.hint}
            </div>
          ) : null;
        })()}
      </div>
    </div>,
    document.body,
  );
}
