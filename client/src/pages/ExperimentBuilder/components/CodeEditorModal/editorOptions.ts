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
  glyphMargin: readOnly,
  fixedOverflowWidgets: true,
  suggest: !readOnly
    ? { showKeywords: true, showFunctions: true, showVariables: true }
    : undefined,
  quickSuggestions: !readOnly ? { other: true, strings: true } : false,
});

export function getEditorColors(isLightMode: boolean) {
  return {
    tabBg: isLightMode ? "#ececec" : "#252526",
    activeTabBg: isLightMode ? "#ffffff" : "#1e1e1e",
    inactiveColor: isLightMode ? "#666" : "#888",
    activeColor: isLightMode ? "#222" : "#ccc",
  };
}
