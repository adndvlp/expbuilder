import { Dispatch, SetStateAction } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  onSave: ((key: string, value: any) => void) | undefined;
  label: string;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  entry: ColumnMappingEntry;
  paramKey: string;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
};

function FunctionInput({
  localInputValues,
  onSave,
  label,
  setLocalInputValues,
  entry,
  paramKey,
  setColumnMapping,
}: Props) {
  return (
    <textarea
      className="w-full p-2 border rounded mt-2 font-mono"
      rows={4}
      placeholder={`Type a function for ${label.toLowerCase()}`}
      value={
        localInputValues[paramKey] ??
        (typeof entry.value === "string" ? entry.value : "")
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

export default FunctionInput;
