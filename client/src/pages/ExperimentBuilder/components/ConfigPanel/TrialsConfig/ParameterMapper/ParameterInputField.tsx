import React from "react";
import { ColumnMappingEntry } from ".";

type Props = {
  entry: ColumnMappingEntry;
  key: string;
  type: string;
  setColumnMapping: (
    value: React.SetStateAction<Record<string, ColumnMappingEntry>>,
  ) => void;
  onSave?: ((key: string, value: any) => void) | undefined;
  csvColumns: string[];
};

function ParameterInputField({
  entry,
  key,
  type,
  setColumnMapping,
  onSave,
  csvColumns,
}: Props) {
  return (
    <select
      value={
        entry.source === "typed"
          ? "type_value"
          : entry.source === "csv" &&
              (typeof entry.value === "string" ||
                typeof entry.value === "number")
            ? entry.value
            : type.endsWith("_array") &&
                (key === "calibration_points" || key === "validation_points") &&
                Array.isArray(entry.value)
              ? JSON.stringify(entry.value)
              : ""
      }
      onChange={(e) => {
        const value = e.target.value;
        // Si es uno de los presets, parsea el string a array
        if (
          type.endsWith("_array") &&
          (key === "calibration_points" || key === "validation_points") &&
          (value ===
            JSON.stringify([
              [20, 20],
              [80, 20],
              [50, 50],
              [20, 80],
              [80, 80],
            ]) ||
            value ===
              JSON.stringify([
                [20, 20],
                [50, 20],
                [80, 20],
                [20, 50],
                [50, 50],
                [80, 50],
                [20, 80],
                [50, 80],
                [80, 80],
              ]) ||
            value ===
              JSON.stringify([
                [20, 20],
                [50, 20],
                [80, 20],
                [20, 50],
                [50, 50],
                [80, 50],
                [20, 80],
                [50, 80],
                [80, 80],
                [35, 35],
                [65, 35],
                [35, 65],
                [65, 65],
              ]))
        ) {
          const newValue = {
            source: "typed" as const,
            value: JSON.parse(value),
          };
          setColumnMapping((prev) => ({
            ...prev,
            [key]: newValue,
          }));
          if (onSave) {
            setTimeout(() => onSave(key, newValue), 100);
          }
          return;
        }
        const source =
          value === "type_value" ? "typed" : value === "" ? "none" : "csv";

        setColumnMapping((prev) => {
          // If source is 'none', remove the parameter from columnMapping
          if (source === "none") {
            const newMapping = { ...prev };
            delete newMapping[key];
            // Autoguardar después de eliminar
            if (onSave) {
              setTimeout(() => onSave(key, undefined), 100);
            }
            return newMapping;
          }

          // Otherwise, add/update the parameter
          const newValue: ColumnMappingEntry = {
            source: source as "csv" | "typed",
            value:
              source === "typed"
                ? type === "boolean"
                  ? false
                  : type === "number"
                    ? 0
                    : type.endsWith("_array")
                      ? []
                      : type === "object" && key === "coordinates"
                        ? { x: 0, y: 0 }
                        : ""
                : value,
          };

          // Autoguardar después de cambiar source/CSV column
          if (onSave) {
            setTimeout(() => onSave(key, newValue), 100);
          }

          return {
            ...prev,
            [key]: newValue,
          };
        });
      }}
      className="w-full p-2 border rounded"
    >
      <option value="">Default value</option>
      <option value="type_value">Type value</option>
      {csvColumns &&
        csvColumns.length > 0 &&
        csvColumns.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      {/* Presets para calibration/validation */}
      {type.endsWith("_array") &&
        (key === "calibration_points" || key === "validation_points") && (
          <>
            <option
              value={JSON.stringify([
                [20, 20],
                [80, 20],
                [50, 50],
                [20, 80],
                [80, 80],
              ])}
            >
              5 points
            </option>
            <option
              value={JSON.stringify([
                [20, 20],
                [50, 20],
                [80, 20],
                [20, 50],
                [50, 50],
                [80, 50],
                [20, 80],
                [50, 80],
                [80, 80],
              ])}
            >
              9 points
            </option>
            <option
              value={JSON.stringify([
                [20, 20],
                [50, 20],
                [80, 20],
                [20, 50],
                [50, 50],
                [80, 50],
                [20, 80],
                [50, 80],
                [80, 80],
                [35, 35],
                [65, 35],
                [35, 65],
                [65, 65],
              ])}
            >
              13 points
            </option>
          </>
        )}
    </select>
  );
}

export default ParameterInputField;
