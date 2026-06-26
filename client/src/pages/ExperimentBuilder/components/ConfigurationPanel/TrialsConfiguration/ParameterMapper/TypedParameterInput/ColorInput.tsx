import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  paramKey: string;
  entry: ColumnMappingEntry;
  label: string;
  onSave: ((key: string, value: any) => void) | undefined;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
};

const COLOR_SWATCHES = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
];

function supportsTransparent(paramKey: string) {
  return paramKey.includes("background") || paramKey.includes("border");
}

const fieldStyle: CSSProperties = {
  width: "100%",
  height: 38,
  border: "1px solid #475569",
  borderRadius: 8,
  background: "#111827",
  color: "#f8fafc",
  padding: "0 10px",
  outline: "none",
  boxSizing: "border-box",
};

function swatchStyle(color: string, active: boolean): CSSProperties {
  return {
    width: 28,
    height: 28,
    border: active ? "2px solid #38bdf8" : "1px solid #64748b",
    borderRadius: 7,
    background: color,
    boxShadow: active ? "0 0 0 2px rgba(56, 189, 248, 0.22)" : "none",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };
}

/**
 * ColorInput – renders an <input type="color"> swatch next to a hex text input
 * for any parameter whose key ends with `_color`.
 */
function ColorInput({
  localInputValues,
  setColumnMapping,
  paramKey,
  entry,
  onSave,
  label,
  setLocalInputValues,
}: Props) {
  const currentText =
    localInputValues[paramKey] ??
    (typeof entry.value === "string" ? entry.value : "#000000");

  const commit = (hex: string) => {
    const newValue = { source: "typed" as const, value: hex };
    setColumnMapping((prev) => ({ ...prev, [paramKey]: newValue }));
    if (onSave) setTimeout(() => onSave(paramKey, newValue), 100);
    setLocalInputValues((prev) => {
      const next = { ...prev };
      delete next[paramKey];
      return next;
    });
  };

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "42px minmax(0, 1fr)",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          type="color"
          value={
            /^#[0-9a-fA-F]{6}$/.test(currentText) ? currentText : "#000000"
          }
          onChange={(e) => {
            setLocalInputValues((prev) => ({
              ...prev,
              [paramKey]: e.target.value,
            }));
          }}
          onBlur={(e) => commit(e.target.value)}
          style={{
            width: 38,
            height: 38,
            padding: 2,
            border: "1px solid #64748b",
            borderRadius: 8,
            background: "#111827",
            cursor: "pointer",
            flexShrink: 0,
          }}
          title={label}
        />
        <input
          type="text"
          className=""
          placeholder={`e.g. #0ea5e9`}
          style={fieldStyle}
          value={currentText}
          onChange={(e) => {
            setLocalInputValues((prev) => ({
              ...prev,
              [paramKey]: e.target.value,
            }));
          }}
          onBlur={(e) => commit(e.target.value)}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 10,
        }}
      >
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${color}`}
            onClick={() => commit(color)}
            style={swatchStyle(color, currentText === color)}
          />
        ))}
        {supportsTransparent(paramKey) && (
          <button
            type="button"
            aria-label={`${label} transparent`}
            title="transparent"
            onClick={() => commit("transparent")}
            style={{
              ...swatchStyle("#ffffff", currentText === "transparent"),
              position: "relative",
              backgroundColor: "#ffffff",
              backgroundImage:
                "linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)",
              backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
              backgroundSize: "8px 8px",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 5,
                right: 5,
                top: 13,
                height: 2,
                borderRadius: 999,
                background: "#ef4444",
                transform: "rotate(-35deg)",
              }}
            />
          </button>
        )}
      </div>
    </div>
  );
}

export default ColorInput;
