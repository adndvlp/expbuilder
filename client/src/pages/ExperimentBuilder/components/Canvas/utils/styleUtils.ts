import React from "react";

export function getIsDarkMode(): boolean {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function getCanvasBackground(isDark: boolean): React.CSSProperties {
  return {
    background: isDark
      ? "radial-gradient(circle at 50% 50%, #23272f 80%, #181a20 100%)"
      : "radial-gradient(circle at 50% 50%, #f7f8fa 80%, #e9ecf3 100%)",
    minHeight: "100vh",
    width: "100%",
    height: "100vh",
    position: "relative",
    overflow: "visible",
  };
}

export function getPatternStyle(isDark: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    backgroundImage:
      "radial-gradient(circle, " +
      (isDark ? "#3a3f4b" : "#dbe2ea") +
      " 1px, transparent 1.5px)",
    backgroundSize: "28px 28px",
    zIndex: 0,
  };
}

export function getFabStyle(isDark: boolean): React.CSSProperties {
  return {
    width: "56px",
    height: "56px",
    background: isDark ? "#ffb300" : "#1976d2",
    color: isDark ? "#23272f" : "#fff",
    borderRadius: "50%",
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "fixed",
    bottom: "32px",
    right: "32px",
    zIndex: 10,
    fontSize: "32px",
    border: "none",
    outline: "none",
    transition: "background 0.2s",
  };
}
