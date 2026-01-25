import { useState } from "react";
import Switch from "react-switch";
import { BiEdit } from "react-icons/bi";

type UploadedFile = { name: string; url: string; type: string };

type ParameterInputProps = {
  paramKey: string;
  paramLabel: string;
  paramType: string;
  value: any;
  onChange: (value: any) => void;
  onOpenHtmlModal?: () => void;
  onOpenSurveyModal?: () => void;
  onOpenButtonModal?: () => void;
  uploadedFiles?: UploadedFile[];
};

/**
 * ParameterInput Component
 *
 * Renders the appropriate input control based on parameter type.
 * Supports: boolean, number, string, html_string, html_string_array,
 * object (survey_json), arrays, etc.
 *
 * Reusable in ParameterMapper and ParameterOverrideCells.
 */
export const ParameterInput: React.FC<ParameterInputProps> = ({
  paramKey,
  paramLabel,
  paramType,
  value,
  onChange,
  onOpenHtmlModal,
  onOpenSurveyModal,
}) => {
  const [localInputValue, setLocalInputValue] = useState<string>("");

  // Boolean input
  if (paramType === "boolean") {
    return (
      <div className="mt-2 flex items-center gap-3">
        <Switch
          checked={value === true}
          onChange={(checked) => onChange(checked)}
          onColor="#3d92b4"
          onHandleColor="#ffffff"
          handleDiameter={24}
          uncheckedIcon={false}
          checkedIcon={false}
          height={20}
          width={44}
        />
        <span style={{ fontWeight: 500, color: "var(--text-dark)" }}>
          {value === true ? "True" : "False"}
        </span>
      </div>
    );
  }

  // HTML String input (with GrapesJS editor)
  if (paramType === "html_string") {
    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          className="flex-1 p-2 border rounded bg-gray-100"
          value={typeof value === "string" ? value : ""}
          readOnly
          placeholder="Click edit to add HTML content"
        />
        <button
          type="button"
          onClick={onOpenHtmlModal}
          className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1 transition-colors"
        >
          <BiEdit size={16} />
          Edit
        </button>
      </div>
    );
  }

  // HTML String Array input (with GrapesJS editor)
  if (paramType === "html_string_array") {
    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          className="flex-1 p-2 border rounded bg-gray-100"
          value={
            Array.isArray(value) &&
            value.length > 0 &&
            typeof value[0] === "string"
              ? value[0].substring(0, 50) + (value[0].length > 50 ? "..." : "")
              : ""
          }
          readOnly
          placeholder="Click edit to add HTML content (array)"
        />
        <button
          type="button"
          onClick={onOpenHtmlModal}
          className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1 transition-colors"
        >
          <BiEdit size={16} />
          Edit HTML Array
        </button>
      </div>
    );
  }

  // Survey JSON input (with Survey Builder)
  if (paramType === "object" && paramKey === "survey_json") {
    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          className="flex-1 p-2 border rounded bg-gray-100"
          value={
            typeof value === "object"
              ? `Survey: ${Object.keys(value).length > 0 ? Object.keys(value).join(", ").substring(0, 30) + "..." : "Empty"}`
              : "Click edit to design survey"
          }
          readOnly
          placeholder="Click edit to design survey"
        />
        <button
          type="button"
          onClick={onOpenSurveyModal}
          className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1 transition-colors"
        >
          <BiEdit size={16} />
          Design Survey
        </button>
      </div>
    );
  }

  // Number input
  if (paramType === "number" || paramType === "int" || paramType === "float") {
    return (
      <input
        type="number"
        min={0}
        step="any"
        className="w-full p-2 border rounded mt-2"
        value={
          typeof value === "string" || typeof value === "number" ? value : ""
        }
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }

  // Array inputs (comma-separated)
  if (
    paramType.endsWith("_array") &&
    paramKey !== "calibration_points" &&
    paramKey !== "validation_points"
  ) {
    return (
      <input
        type="text"
        className="w-full p-2 border rounded mt-2"
        placeholder={`Comma-separated values for ${paramLabel.toLowerCase()}`}
        value={
          localInputValue !== ""
            ? localInputValue
            : typeof value === "string"
              ? value
              : Array.isArray(value)
                ? value.join(", ")
                : ""
        }
        onChange={(e) => setLocalInputValue(e.target.value)}
        onBlur={(e) => {
          const input =
            localInputValue !== "" ? localInputValue : e.target.value;

          const rawItems = input
            .split(",")
            .map((item) => item.trim().replace(/\s{2,}/g, " "))
            .filter((item) => item.length > 0);

          const baseType = paramType.replace(/_array$/, "");

          const castedArray = rawItems.map((item) => {
            switch (baseType) {
              case "number":
              case "int":
              case "float":
                if (item === "" || isNaN(Number(item))) return item;
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

          onChange(castedArray);
          setLocalInputValue("");
        }}
      />
    );
  }

  // Calibration/Validation points (special array format)
  if (
    paramType.endsWith("_array") &&
    (paramKey === "calibration_points" || paramKey === "validation_points")
  ) {
    return (
      <input
        type="text"
        className="w-full p-2 border rounded mt-2"
        placeholder={`Enter ${paramLabel.toLowerCase()}`}
        value={
          localInputValue !== ""
            ? localInputValue
            : Array.isArray(value)
              ? JSON.stringify(value).replace(/],\[/g, "], [")
              : ""
        }
        onChange={(e) => setLocalInputValue(e.target.value)}
        onBlur={() => {
          if (localInputValue.trim() === "") {
            onChange([]);
            setLocalInputValue("");
            return;
          }

          try {
            const parsed = JSON.parse(localInputValue);
            onChange(parsed);
          } catch {
            // Invalid JSON, keep as is
          }

          setLocalInputValue("");
        }}
      />
    );
  }

  // Object type (coordinates)
  if (paramType === "object" && paramKey === "coordinates") {
    const coords = value || { x: 0, y: 0 };
    return (
      <div className="mt-2 flex gap-2">
        <input
          type="number"
          step="0.01"
          className="w-1/2 p-2 border rounded"
          placeholder="X"
          value={coords.x || 0}
          onChange={(e) => onChange({ ...coords, x: Number(e.target.value) })}
        />
        <input
          type="number"
          step="0.01"
          className="w-1/2 p-2 border rounded"
          placeholder="Y"
          value={coords.y || 0}
          onChange={(e) => onChange({ ...coords, y: Number(e.target.value) })}
        />
      </div>
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      className="w-full p-2 border rounded mt-2"
      placeholder={`Enter ${paramLabel.toLowerCase()}`}
      value={
        typeof value === "string" || typeof value === "number" ? value : ""
      }
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
