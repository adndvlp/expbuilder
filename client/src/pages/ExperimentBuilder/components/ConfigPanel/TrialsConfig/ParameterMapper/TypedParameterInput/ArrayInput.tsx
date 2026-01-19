import { Dispatch, SetStateAction } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  label: string;
  key: string;
  entry: ColumnMappingEntry;
  onSave?: ((key: string, value: any) => void) | undefined;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  type: string;
};

function ArrayInput({
  localInputValues,
  setLocalInputValues,
  label,
  key,
  entry,
  onSave,
  setColumnMapping,
  type,
}: Props) {
  return (
    <input
      type="text"
      className="w-full p-2 border rounded mt-2"
      placeholder={`Comma-separated values for ${label.toLowerCase()}`}
      value={
        localInputValues[key] ??
        (typeof entry.value === "string"
          ? entry.value
          : Array.isArray(entry.value)
            ? entry.value.join(", ")
            : "")
      }
      onChange={(e) => {
        setLocalInputValues((prev) => ({
          ...prev,
          [key]: e.target.value,
        }));
      }}
      onBlur={(e) => {
        const input = localInputValues[key] ?? e.target.value;

        const rawItems = input
          .split(",")

          .map((item) => item.trim().replace(/\s{2,}/g, " "))
          .filter((item) => item.length > 0);

        const baseType = type.replace(/_array$/, "");

        const castedArray = rawItems.map((item) => {
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

        const newValue = {
          source: "typed" as const,
          value: castedArray,
        };
        setColumnMapping((prev) => ({
          ...prev,
          [key]: newValue,
        }));
        if (onSave) {
          setTimeout(() => onSave(key, newValue), 100);
        }

        setLocalInputValues((prev) => {
          const newState = { ...prev };
          delete newState[key];
          return newState;
        });
      }}
    />
  );
}

export default ArrayInput;
