import { Dispatch, SetStateAction } from "react";
import { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  onSave?: ((key: string, value: any) => void) | undefined;
  entry: ColumnMappingEntry;
  key: string;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
};

function ObjectCoordsInput({
  localInputValues,
  onSave,
  entry,
  setLocalInputValues,
  setColumnMapping,
  key,
}: Props) {
  return (
    <>
      <label className="block mt-2">x:</label>
      <input
        type="number"
        min={-1}
        max={1}
        step="any"
        className="w-full p-2 border rounded mt-1"
        value={
          localInputValues[`${key}_x`] ??
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
            [`${key}_x`]: e.target.value,
          }));
        }}
        onBlur={(e) => {
          const rawValue = Number(e.target.value);
          const clampedValue = Math.max(-1, Math.min(1, rawValue));
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
            [key]: newValue,
          }));
          if (onSave) {
            setTimeout(() => onSave(key, newValue), 100);
          }
          setLocalInputValues((prev) => {
            const newState = { ...prev };
            delete newState[`${key}_x`];
            return newState;
          });
        }}
      />

      <label className="block mt-2">y:</label>
      <input
        type="number"
        min={-1}
        max={1}
        step="any"
        className="w-full p-2 border rounded mt-1"
        value={
          localInputValues[`${key}_y`] ??
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
            [`${key}_y`]: e.target.value,
          }));
        }}
        onBlur={(e) => {
          const rawValue = Number(e.target.value);
          const clampedValue = Math.max(-1, Math.min(1, rawValue));
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
            [key]: newValue,
          }));
          if (onSave) {
            setTimeout(() => onSave(key, newValue), 100);
          }
          setLocalInputValues((prev) => {
            const newState = { ...prev };
            delete newState[`${key}_y`];
            return newState;
          });
        }}
      />
    </>
  );
}

export default ObjectCoordsInput;
