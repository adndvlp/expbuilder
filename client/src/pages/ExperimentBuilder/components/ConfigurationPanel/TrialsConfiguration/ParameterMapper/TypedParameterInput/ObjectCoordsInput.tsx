import { Dispatch, SetStateAction } from "react";
import type { CSSProperties } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  onSave: ((key: string, value: any) => void) | undefined;
  entry: ColumnMappingEntry;
  paramKey: string;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  componentMode?: boolean;
};

const INSPECTOR_LABEL_STYLE: CSSProperties = {
  display: "block",
  margin: "0 0 7px",
  color: "#c8d3dc",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: "16px",
};

const INSPECTOR_INPUT_STYLE: CSSProperties = {
  width: "100%",
  height: 36,
  border: "1px solid #3d5066",
  borderRadius: 8,
  background: "#0e1724",
  color: "#f8fafc",
  padding: "0 10px",
  outline: "none",
  boxSizing: "border-box",
};

function ObjectCoordsInput({
  localInputValues,
  onSave,
  entry,
  setLocalInputValues,
  setColumnMapping,
  paramKey,
  componentMode = false,
}: Props) {
  return (
    <>
      <label
        className={componentMode ? "" : "block mt-2"}
        style={componentMode ? INSPECTOR_LABEL_STYLE : undefined}
      >
        x:
      </label>
      <input
        type={componentMode ? "text" : "number"}
        inputMode={componentMode ? "decimal" : undefined}
        min={-100}
        max={100}
        step="any"
        className={componentMode ? "" : "w-full p-2 border rounded mt-1"}
        style={componentMode ? INSPECTOR_INPUT_STYLE : undefined}
        value={
          localInputValues[`${paramKey}_x`] ??
          (entry.value &&
          typeof entry.value === "object" &&
          "x" in entry.value &&
          typeof (entry.value as any).x === "number"
            ? (entry.value as any).x
            : 0)
        }
        onChange={(e) => {
          setLocalInputValues((prev) => ({
            ...prev,
            [`${paramKey}_x`]: e.target.value,
          }));
        }}
        onBlur={(e) => {
          const rawValue = Number(e.target.value);
          const clampedValue = Math.max(-100, Math.min(100, rawValue));
          const coordValue = {
            ...(entry.value &&
            typeof entry.value === "object" &&
            "x" in entry.value &&
            "y" in entry.value
              ? entry.value
              : { x: 0, y: 0 }),
            x: clampedValue,
          };
          const newValue = {
            source: "typed" as const,
            value: coordValue,
          };
          setColumnMapping((prev) => ({
            ...prev,
            [paramKey]: newValue,
          }));
          if (onSave) {
            setTimeout(() => onSave(paramKey, newValue), 100);
          }
          setLocalInputValues((prev) => {
            const newState = { ...prev };
            delete newState[`${paramKey}_x`];
            return newState;
          });
        }}
      />

      <label
        className={componentMode ? "" : "block mt-2"}
        style={{
          ...(componentMode ? INSPECTOR_LABEL_STYLE : {}),
          marginTop: componentMode ? 10 : undefined,
        }}
      >
        y:
      </label>
      <input
        type={componentMode ? "text" : "number"}
        inputMode={componentMode ? "decimal" : undefined}
        min={-100}
        max={100}
        step="any"
        className={componentMode ? "" : "w-full p-2 border rounded mt-1"}
        style={componentMode ? INSPECTOR_INPUT_STYLE : undefined}
        value={
          localInputValues[`${paramKey}_y`] ??
          (entry.value &&
          typeof entry.value === "object" &&
          "y" in entry.value &&
          typeof (entry.value as any).y === "number"
            ? (entry.value as any).y
            : 0)
        }
        onChange={(e) => {
          setLocalInputValues((prev) => ({
            ...prev,
            [`${paramKey}_y`]: e.target.value,
          }));
        }}
        onBlur={(e) => {
          const rawValue = Number(e.target.value);
          const clampedValue = Math.max(-100, Math.min(100, rawValue));
          const coordValue = {
            ...(entry.value &&
            typeof entry.value === "object" &&
            "x" in entry.value &&
            "y" in entry.value
              ? entry.value
              : { x: 0, y: 0 }),
            y: clampedValue,
          };
          const newValue = {
            source: "typed" as const,
            value: coordValue,
          };
          setColumnMapping((prev) => ({
            ...prev,
            [paramKey]: newValue,
          }));
          if (onSave) {
            setTimeout(() => onSave(paramKey, newValue), 100);
          }
          setLocalInputValues((prev) => {
            const newState = { ...prev };
            delete newState[`${paramKey}_y`];
            return newState;
          });
        }}
      />
    </>
  );
}

export default ObjectCoordsInput;
