import type { CSSProperties } from "react";

const CONTROL_BORDER = "#3d5066";
const CONTROL_BG = "#0e1724";
const CONTROL_TEXT = "#f8fafc";
const CONTROL_MUTED = "#cbd5e1";
const CONTROL_ACTIVE_BG = "#164e63";
const CONTROL_ACTIVE_BORDER = "#38bdf8";

export const fieldStyle: CSSProperties = {
  width: "100%",
  height: 36,
  border: `1px solid ${CONTROL_BORDER}`,
  borderRadius: 8,
  background: CONTROL_BG,
  color: CONTROL_TEXT,
  padding: "0 10px",
  outline: "none",
  boxSizing: "border-box",
};

export function buttonStyle(active: boolean): CSSProperties {
  return {
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: active
      ? `1px solid ${CONTROL_ACTIVE_BORDER}`
      : `1px solid ${CONTROL_BORDER}`,
    borderRadius: 8,
    background: active ? CONTROL_ACTIVE_BG : "#172233",
    color: active ? "#e0f2fe" : CONTROL_MUTED,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
  };
}

export function segmentedButtonStyle(
  active: boolean,
  index: number,
  total: number,
): CSSProperties {
  return {
    ...buttonStyle(active),
    width: 38,
    borderRadius:
      total === 1
        ? 8
        : index === 0
          ? "8px 0 0 8px"
          : index === total - 1
            ? "0 8px 8px 0"
            : 0,
    background: active ? CONTROL_ACTIVE_BG : CONTROL_BG,
    color: active ? "#e0f2fe" : CONTROL_MUTED,
    marginLeft: index === 0 ? 0 : -1,
  };
}
