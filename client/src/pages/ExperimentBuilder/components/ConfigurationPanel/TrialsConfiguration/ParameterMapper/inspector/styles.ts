import type React from "react";

export const panelStyle: React.CSSProperties = {
  color: "#e5edf3",
  padding: "8px 16px 24px",
};
export const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 12,
};
export const fieldStyle: React.CSSProperties = { minWidth: 0 };
export const labelStyle: React.CSSProperties = {
  display: "block",
  margin: "0 0 7px",
  color: "#c8d3dc",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: "16px",
};
export const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  border: "1px solid #3d5066",
  borderRadius: 8,
  background: "#0e1724",
  color: "#f8fafc",
  padding: "0 10px",
  outline: "none",
};
export const sectionStyle: React.CSSProperties = {
  padding: "12px",
  border: "1px solid rgba(120, 144, 170, 0.24)",
  borderRadius: 8,
  background: "rgba(15, 23, 34, 0.58)",
};
export const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
};
export const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: "18px",
};
export const sectionBodyStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px 10px",
};
