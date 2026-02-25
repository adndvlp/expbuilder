import { Dispatch, SetStateAction } from "react";
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
    <div className="flex items-center gap-2 mt-2">
      {/* Native color swatch */}
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(currentText) ? currentText : "#000000"}
        onChange={(e) => {
          setLocalInputValues((prev) => ({
            ...prev,
            [paramKey]: e.target.value,
          }));
        }}
        onBlur={(e) => commit(e.target.value)}
        style={{
          width: 36,
          height: 36,
          padding: 2,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          cursor: "pointer",
          flexShrink: 0,
        }}
        title={label}
      />
      {/* Editable hex text */}
      <input
        type="text"
        className="flex-1 p-2 border rounded"
        placeholder={`e.g. #9333ea`}
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
  );
}

export default ColorInput;
