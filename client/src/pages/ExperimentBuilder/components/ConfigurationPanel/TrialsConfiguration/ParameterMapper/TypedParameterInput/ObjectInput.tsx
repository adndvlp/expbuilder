import { Dispatch, SetStateAction } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  onSave: ((key: string, value: any) => void) | undefined;
  paramKey: string;
  entry: ColumnMappingEntry;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
};

function ObjectInput({ onSave, entry, setColumnMapping, paramKey }: Props) {
  return (
    <textarea
      className="w-full p-2 border rounded mt-2 font-mono"
      rows={8}
      placeholder={`Type an object, for example:\n{\n  showQuestionNumbers: false,\n  elements: [ ... ]\n}`}
      value={
        typeof entry.value === "string"
          ? entry.value
          : entry.value && typeof entry.value === "object"
            ? JSON.stringify(entry.value, null, 2)
            : ""
      }
      onChange={(e) => {
        const newValue = {
          source: "typed" as const,
          value: e.target.value,
        };
        setColumnMapping((prev) => ({
          ...prev,
          [paramKey]: newValue,
        }));
      }}
      onBlur={(e) => {
        const input = e.target.value.trim();
        let finalValue;
        try {
          // eslint-disable-next-line no-new-func
          finalValue = Function('"use strict";return (' + input + ")")();
        } catch (err) {
          // If fails, keep text as string
          finalValue = input;
        }
        const newValue = {
          source: "typed" as const,
          value: finalValue,
        };
        setColumnMapping((prev) => ({
          ...prev,
          [paramKey]: newValue,
        }));
        if (onSave) {
          setTimeout(() => onSave(paramKey, newValue), 100);
        }
      }}
    />
  );
}

export default ObjectInput;
