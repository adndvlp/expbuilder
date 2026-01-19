import { Dispatch, SetStateAction } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  onSave?: ((key: string, value: any) => void) | undefined;
  label: string;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  entry: ColumnMappingEntry;
  key: string;
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
  key,
  setColumnMapping,
}: Props) {
  return (
    <textarea
      className="w-full p-2 border rounded mt-2 font-mono"
      rows={4}
      placeholder={`Type a function for ${label.toLowerCase()}`}
      value={
        localInputValues[key] ??
        (typeof entry.value === "string" ? entry.value : "")
      }
      onChange={(e) => {
        setLocalInputValues((prev) => ({
          ...prev,
          [key]: e.target.value,
        }));
      }}
      onBlur={(e) => {
        const newValue = {
          source: "typed" as const,
          value: e.target.value,
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

export default FunctionInput;
