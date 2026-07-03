import { Dispatch, SetStateAction } from "react";
import type { CSSProperties } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  label: string;
  paramKey: string;
  entry: ColumnMappingEntry;
  onSave: ((key: string, value: any) => void) | undefined;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  type: string;
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

function parseArrayInput(input: string, type: string) {
  const rawItems = input
    .split(",")
    .map((item) => item.trim().replace(/\s{2,}/g, " "))
    .filter((item) => item.length > 0);

  const baseType = type.replace(/_array$/, "");

  return rawItems.map((item) => {
    switch (baseType) {
      case "number":
      case "int":
      case "float":
        if (item === "" || isNaN(Number(item))) {
          return item;
        }
        return Number(item);
      case "boolean":
      case "bool": {
        const lower = item.toLowerCase();
        if (lower === "true") return true;
        if (lower === "false") return false;
        return item;
      }
      default:
        return item;
    }
  });
}

function ArrayInput({
  localInputValues,
  setLocalInputValues,
  label,
  paramKey,
  entry,
  onSave,
  setColumnMapping,
  type,
  componentMode = false,
}: Props) {
  return (
    <input
      type="text"
      className={componentMode ? "" : "w-full p-2 border rounded mt-2"}
      style={componentMode ? INSPECTOR_INPUT_STYLE : undefined}
      placeholder={`Comma-separated values for ${label.toLowerCase()}`}
      value={
        localInputValues[paramKey] ??
        (typeof entry.value === "string"
          ? entry.value
          : Array.isArray(entry.value)
            ? entry.value.join(", ")
            : "")
      }
      onChange={(e) => {
        const input = e.target.value;
        setLocalInputValues((prev) => ({
          ...prev,
          [paramKey]: input,
        }));
        if (componentMode) {
          setColumnMapping((prev) => ({
            ...prev,
            [paramKey]: {
              source: "typed" as const,
              value: parseArrayInput(input, type),
            },
          }));
        }
      }}
      onBlur={(e) => {
        const input = localInputValues[paramKey] ?? e.target.value;

        const newValue = {
          source: "typed" as const,
          value: parseArrayInput(input, type),
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

export default ArrayInput;
