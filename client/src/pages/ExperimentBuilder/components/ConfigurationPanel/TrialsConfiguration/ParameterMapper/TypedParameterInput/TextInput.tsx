import { Dispatch, SetStateAction } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  key: string;
  entry: ColumnMappingEntry;
  label: string;
  onSave?: ((key: string, value: any) => void) | undefined;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
};

function TextInput({
  localInputValues,
  setColumnMapping,
  key,
  entry,
  onSave,
  label,
  setLocalInputValues,
}: Props) {
  return (
    <input
      type="text"
      className="w-full p-2 border rounded mt-2"
      placeholder={`Type a value for ${label.toLowerCase()}`}
      value={
        localInputValues[key] ??
        (typeof entry.value === "string" || typeof entry.value === "number"
          ? entry.value
          : "")
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

export default TextInput;
