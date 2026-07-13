export type EditorTheme = {
  tabBg: string;
  activeTabBg: string;
  editorBg: string;
  borderColor: string;
  panelHeaderBg: string;
  panelHeaderColor: string;
};

export function getEditorTheme(isLightMode: boolean): EditorTheme {
  return {
    tabBg: isLightMode ? "#ececec" : "#252526",
    activeTabBg: isLightMode ? "#ffffff" : "#1e1e1e",
    editorBg: isLightMode ? "#fff" : "#1e1e1e",
    borderColor: isLightMode ? "#ddd" : "#3c3c3c",
    panelHeaderBg: isLightMode ? "#f5f5f5" : "#2d2d2d",
    panelHeaderColor: isLightMode ? "#666" : "#888",
  };
}

export const getEditorOptions = (readOnly: boolean) => ({
  readOnly,
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  lineNumbers: "on" as const,
  tabSize: 2,
  wordWrap: "on" as const,
  folding: true,
  fixedOverflowWidgets: true,
  glyphMargin: readOnly,
  suggest: !readOnly
    ? { showKeywords: true, showFunctions: true, showVariables: true }
    : undefined,
  quickSuggestions: !readOnly
    ? ({ other: true, strings: true } as const)
    : (false as const),
});
