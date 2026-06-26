import React from "react";
import { ColumnMappingEntry } from ".";

const WEBGAZER_POINT_PRESETS = [
  {
    label: "5 points",
    value: [
      [20, 20],
      [80, 20],
      [50, 50],
      [20, 80],
      [80, 80],
    ],
  },
  {
    label: "9 points",
    value: [
      [20, 20],
      [50, 20],
      [80, 20],
      [20, 50],
      [50, 50],
      [80, 50],
      [20, 80],
      [50, 80],
      [80, 80],
    ],
  },
  {
    label: "13 points",
    value: [
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
    ],
  },
];

const WEBGAZER_POINT_PRESET_VALUES = WEBGAZER_POINT_PRESETS.map((preset) =>
  JSON.stringify(preset.value),
);

function isWebgazerPointsParam(type: string, paramKey: string) {
  return (
    type.endsWith("_array") &&
    (paramKey === "calibration_points" || paramKey === "validation_points")
  );
}

type Props = {
  entry: ColumnMappingEntry;
  paramKey: string;
  type: string;
  setColumnMapping: (
    value: React.SetStateAction<Record<string, ColumnMappingEntry>>,
  ) => void;
  onSave?: ((key: string, value: any) => void) | undefined;
  csvColumns: string[];
  componentMode?: boolean;
};

function ParameterInputField({
  entry,
  paramKey,
  type,
  setColumnMapping,
  onSave,
  csvColumns,
  componentMode = false,
}: Props) {
  const selectedWebgazerPreset =
    isWebgazerPointsParam(type, paramKey) &&
    entry.source === "typed" &&
    Array.isArray(entry.value)
      ? WEBGAZER_POINT_PRESET_VALUES.find(
          (presetValue) => presetValue === JSON.stringify(entry.value),
        )
      : undefined;

  return (
    <select
      value={
        selectedWebgazerPreset ??
        (entry.source === "typed"
          ? "type_value"
          : entry.source === "csv" &&
              (typeof entry.value === "string" ||
                typeof entry.value === "number")
            ? entry.value
            : type.endsWith("_array") &&
                (paramKey === "calibration_points" ||
                  paramKey === "validation_points") &&
                Array.isArray(entry.value)
              ? JSON.stringify(entry.value)
              : "")
      }
      onChange={(e) => {
        const value = e.target.value;
        // Si es uno de los presets, parsea el string a array
        if (
          isWebgazerPointsParam(type, paramKey) &&
          WEBGAZER_POINT_PRESET_VALUES.includes(value)
        ) {
          const newValue = {
            source: "typed" as const,
            value: JSON.parse(value),
          };
          setColumnMapping((prev) => ({
            ...prev,
            [paramKey]: newValue,
          }));
          if (onSave) {
            setTimeout(() => onSave(paramKey, newValue), 100);
          }
          return;
        }
        const source =
          value === "type_value" ? "typed" : value === "" ? "none" : "csv";

        setColumnMapping((prev) => {
          // If source is 'none', remove the parameter from columnMapping
          if (source === "none") {
            const newMapping = { ...prev };
            delete newMapping[paramKey];
            // Autoguardar después de eliminar
            if (onSave) {
              setTimeout(() => onSave(paramKey, undefined), 100);
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
                      : type === "object" && paramKey === "coordinates"
                        ? { x: 0, y: 0 }
                        : ""
                : value,
          };

          // Autoguardar después de cambiar source/CSV column
          if (onSave) {
            setTimeout(() => onSave(paramKey, newValue), 100);
          }

          return {
            ...prev,
            [paramKey]: newValue,
          };
        });
      }}
      className={componentMode ? "" : "w-full p-2 border rounded"}
      style={
        componentMode
          ? {
              width: "100%",
              height: 38,
              border: "1px solid #475569",
              borderRadius: 8,
              background: "#111827",
              color: "#f8fafc",
              padding: "0 10px",
              outline: "none",
            }
          : undefined
      }
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
        (paramKey === "calibration_points" ||
          paramKey === "validation_points") && (
          <>
            {WEBGAZER_POINT_PRESETS.map((preset) => (
              <option key={preset.label} value={JSON.stringify(preset.value)}>
                {preset.label}
              </option>
            ))}
          </>
        )}
    </select>
  );
}

export default ParameterInputField;
