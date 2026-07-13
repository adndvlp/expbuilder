import type { CSSProperties } from "react";

export const inspectorTextInputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #3d5066",
  borderRadius: 8,
  background: "#0e1724",
  color: "#f8fafc",
  padding: "10px 12px",
  outline: "none",
  boxSizing: "border-box",
};

export const inspectorSingleLineInputStyle: CSSProperties = {
  ...inspectorTextInputStyle,
  height: 36,
  marginTop: 8,
  padding: "0 10px",
};
