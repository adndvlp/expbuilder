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
  componentMode?: boolean;
};

const INSPECTOR_INPUT_STYLE: CSSProperties = {
  width: "100%",
  height: 36,
  marginTop: 8,
  border: "1px solid #3d5066",
  borderRadius: 8,
  background: "#0e1724",
  color: "#f8fafc",
  padding: "0 10px",
  outline: "none",
  boxSizing: "border-box",
};

function TextInput({
  localInputValues,
  setColumnMapping,
  paramKey,
  entry,
  onSave,
  label,
  setLocalInputValues,
  componentMode = false,
}: Props) {
  return (
    <input
      type="text"
      className={componentMode ? "" : "w-full p-2 border rounded mt-2"}
      style={componentMode ? INSPECTOR_INPUT_STYLE : undefined}
      placeholder={`Type a value for ${label.toLowerCase()}`}
      value={
        localInputValues[paramKey] ??
        (typeof entry.value === "string" || typeof entry.value === "number"
          ? entry.value
          : "")
      }
      onChange={(e) => {
        setLocalInputValues((prev) => ({
          ...prev,
          [paramKey]: e.target.value,
        }));
      }}
      onBlur={(e) => {
        const newValue = {
          source: "typed" as const,
          value: e.target.value,
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
          delete newState[paramKey];
          return newState;
        });
      }}
    />
  );
}

export default TextInput;
