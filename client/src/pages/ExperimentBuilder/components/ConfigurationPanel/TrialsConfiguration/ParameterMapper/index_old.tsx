import React, { useEffect, useState, useRef } from "react";
import Switch from "react-switch";
import { openExternal } from "../../../../../../lib/openExternal";
import { IoIosHelpCircle } from "react-icons/io";
import { BiEdit } from "react-icons/bi";
import GrapesHtmlEditor from "./TrialDesigner/GrapesEditors/GrapesHtmlEditor";
import GrapesButtonEditor from "./TrialDesigner/GrapesEditors/GrapesButtonEditor";
import SurveyBuilder from "./TrialDesigner/SurveyEditor";
import isEqual from "lodash.isequal";

type UploadedFile = { name: string; url: string; type: string };

type Parameter = {
  label: string;
  key: string;
  type: string;
};

type ColumnMappingEntry = {
  source: "csv" | "typed" | "none";
  value: any;
};

type ParameterMapperProps = {
  parameters: Parameter[];
  columnMapping: Record<string, ColumnMappingEntry>;
  setColumnMapping: React.Dispatch<
    React.SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  csvColumns: string[];
  pluginName: string;
  uploadedFiles?: UploadedFile[];
  // New props for component mode
  componentMode?: boolean; // If true, renders only component parameters without mode toggle
  selectedComponentId?: string | null; // ID of selected component in Konva
  onComponentConfigChange?: (
    componentId: string,
    config: Record<string, any>,
  ) => void;
  // Autoguardado
  onSave?: (key: string, value: any) => void; // Se llama con key y value para evitar closures
};

const ParameterMapper: React.FC<ParameterMapperProps> = ({
  parameters = [],
  columnMapping = {},
  setColumnMapping,
  csvColumns = [],
  pluginName,
  componentMode = false,
  uploadedFiles = [],
  onSave,
}) => {
  const pluginLink = () => {
    const pluginUrl = pluginName
      .replace(/^plugin-/, "")
      .replace(/$/, "#parameters");
    return `https://www.jspsych.org/latest/plugins/${pluginUrl}`;
  };

  const [localInputValues, setLocalInputValues] = useState<
    Record<string, string>
  >({});

  const parametersRef = useRef<Parameter[]>([]);

  // Modal state for HTML editor
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const [currentHtmlKey, setCurrentHtmlKey] = useState<string>("");

  // Modal state for Button editor
  const [isButtonModalOpen, setIsButtonModalOpen] = useState(false);
  const [currentButtonKey, setCurrentButtonKey] = useState<string>("");

  // Modal state for Survey builder
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [currentSurveyKey, setCurrentSurveyKey] = useState<string>("");

  const openHtmlModal = (key: string) => {
    setCurrentHtmlKey(key);
    setIsHtmlModalOpen(true);
  };

  const closeHtmlModal = () => {
    setIsHtmlModalOpen(false);
    setCurrentHtmlKey("");
  };

  const openButtonModal = (key: string) => {
    setCurrentButtonKey(key);
    setIsButtonModalOpen(true);
  };

  const closeButtonModal = () => {
    setIsButtonModalOpen(false);
    setCurrentButtonKey("");
  };

  const openSurveyModal = (key: string) => {
    setCurrentSurveyKey(key);
    setIsSurveyModalOpen(true);
  };

  const closeSurveyModal = () => {
    setIsSurveyModalOpen(false);
    setCurrentSurveyKey("");
  };

  const handleHtmlChange = (htmlValue: string) => {
    if (currentHtmlKey) {
      const param = parameters.find((p) => p.key === currentHtmlKey);
      const isHtmlArray = param?.type === "html_string_array";
      const newValue = {
        source: "typed" as const,
        value: isHtmlArray ? [htmlValue] : htmlValue,
      };

      setColumnMapping((prev) => ({
        ...prev,
        [currentHtmlKey]: newValue,
      }));

      // Autoguardar después de cambiar HTML
      if (onSave) {
        setTimeout(() => onSave(currentHtmlKey, newValue), 100);
      }
    }
  };

  const handleButtonHtmlChange = (htmlTemplate: string) => {
    if (currentButtonKey) {
      // Parse HTML to extract all button elements
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlTemplate, "text/html");
      const buttons = Array.from(doc.querySelectorAll("button"));

      if (buttons.length === 0) {
        alert(
          "No buttons found in the template. Please add at least one button.",
        );
        return;
      }

      // Extract choices from button text content
      const extractedChoices = buttons.map(
        (btn) => btn.textContent?.trim() || "Button",
      );

      // Store the button elements as templates indexed by their position
      const buttonTemplates = buttons.map((btn) => btn.outerHTML);

      // Create button_html function that returns the template for each choice_index
      const functionString = `(choice, choice_index) => {
  const templates = ${JSON.stringify(buttonTemplates)};
  return templates[choice_index] || templates[0];
}`;

      // Update both button_html and choices
      const buttonValue = { source: "typed" as const, value: functionString };
      const choicesValue = {
        source: "typed" as const,
        value: extractedChoices,
      };

      setColumnMapping((prev) => ({
        ...prev,
        [currentButtonKey]: buttonValue,
        // Also update choices if they exist in the parameters
        ...(parameters.some((p) => p.key === "choices") && {
          choices: choicesValue,
        }),
      }));

      // Autoguardar después de cambiar botones
      if (onSave) {
        setTimeout(() => {
          onSave(currentButtonKey, buttonValue);
          if (parameters.some((p) => p.key === "choices")) {
            onSave("choices", choicesValue);
          }
        }, 100);
      }
    }
  };

  const handleSurveyChange = (surveyJson: object) => {
    if (currentSurveyKey) {
      const newValue = { source: "typed" as const, value: surveyJson };

      setColumnMapping((prev) => ({
        ...prev,
        [currentSurveyKey]: newValue,
      }));

      // Autoguardar después de cambiar survey
      if (onSave) {
        setTimeout(() => onSave(currentSurveyKey, newValue), 100);
      }
    }
  };

  useEffect(() => {
    // Only run if parameters actually changed (deep comparison)
    if (isEqual(parameters, parametersRef.current)) {
      return;
    }

    parametersRef.current = parameters;

    // Don't automatically add parameters to columnMapping with source:'none'
    // This allows jsPsych to use its default values when parameters aren't explicitly set
    // Parameters are only added when user selects a CSV column or types a value
    // This matches the behavior of other plugins and prevents polluting columnMapping

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters]);

  return (
    <div className={componentMode ? "" : "mb-4 p-4 border rounded bg-gray-50"}>
      {/* Header - Only show in normal mode */}
      {!componentMode && (
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            style={{
              color: "white",
              display: "flex",
              justifyContent: "flex-end",
              width: "24px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            onClick={() => openExternal(pluginLink())}
          >
            <IoIosHelpCircle size={24} />
          </button>

          <h4 className="text-center flex-1">Configuration</h4>

          <div style={{ width: "24px" }}></div>
        </div>
      )}

      {/* Parameter form */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        {parameters &&
          parameters.length > 0 &&
          parameters.map(({ label, key, type }) => {
            const entry = columnMapping[key] || { source: "none" };

            return (
              <div key={key}>
                <label className="mb-2 mt-3 block text-sm font-medium">
                  {label}
                </label>

                <select
                  value={
                    entry.source === "typed"
                      ? "type_value"
                      : entry.source === "csv" &&
                          (typeof entry.value === "string" ||
                            typeof entry.value === "number")
                        ? entry.value
                        : type.endsWith("_array") &&
                            (key === "calibration_points" ||
                              key === "validation_points") &&
                            Array.isArray(entry.value)
                          ? JSON.stringify(entry.value)
                          : ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    // Si es uno de los presets, parsea el string a array
                    if (
                      type.endsWith("_array") &&
                      (key === "calibration_points" ||
                        key === "validation_points") &&
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
                      value === "type_value"
                        ? "typed"
                        : value === ""
                          ? "none"
                          : "csv";

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
                    (key === "calibration_points" ||
                      key === "validation_points") && (
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

                {entry.source === "typed" && (
                  <>
                    {type === "boolean" ? (
                      <div className="mt-2 flex items-center gap-3">
                        <Switch
                          checked={entry.value === true}
                          onChange={(checked) => {
                            const newValue = {
                              source: "typed" as const,
                              value: checked,
                            };
                            setColumnMapping((prev) => ({
                              ...prev,
                              [key]: newValue,
                            }));
                            if (onSave) {
                              setTimeout(() => onSave(key, newValue), 100);
                            }
                          }}
                          onColor="#3d92b4"
                          onHandleColor="#ffffff"
                          handleDiameter={24}
                          uncheckedIcon={false}
                          checkedIcon={false}
                          height={20}
                          width={44}
                        />
                        <span
                          style={{ fontWeight: 500, color: "var(--text-dark)" }}
                        >
                          {entry.value === true ? "True" : "False"}
                        </span>
                      </div>
                    ) : type === "html_string" ? (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 p-2 border rounded bg-gray-100"
                            value={
                              typeof entry.value === "string" ? entry.value : ""
                            }
                            readOnly
                            placeholder="Click edit to add HTML content"
                          />
                          <button
                            type="button"
                            onClick={() => openHtmlModal(key)}
                            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1 transition-colors"
                          >
                            <BiEdit size={16} />
                            Edit
                          </button>
                        </div>
                      </>
                    ) : type === "object" && key === "survey_json" ? (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 p-2 border rounded bg-gray-100"
                            value={
                              typeof entry.value === "object"
                                ? `Survey: ${Object.keys(entry.value).length > 0 ? Object.keys(entry.value).join(", ").substring(0, 30) + "..." : "Empty"}`
                                : "Click edit to design survey"
                            }
                            readOnly
                            placeholder="Click edit to design survey"
                          />
                          <button
                            type="button"
                            onClick={() => openSurveyModal(key)}
                            className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1 transition-colors"
                          >
                            <BiEdit size={16} />
                            Design Survey
                          </button>
                        </div>
                      </>
                    ) : type === "number" ? (
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="w-full p-2 border rounded mt-2"
                        value={
                          typeof entry.value === "string" ||
                          typeof entry.value === "number"
                            ? entry.value
                            : ""
                        }
                        onChange={(e) => {
                          const rawValue = Number(e.target.value);
                          const newValue = {
                            source: "typed" as const,
                            value: rawValue,
                          };
                          setColumnMapping((prev) => ({
                            ...prev,
                            [key]: newValue,
                          }));
                          if (onSave) {
                            setTimeout(() => onSave(key, newValue), 100);
                          }
                        }}
                      />
                    ) : type.endsWith("_array") &&
                      key !== "calibration_points" &&
                      key !== "validation_points" ? (
                      type === "html_string_array" ? (
                        <>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              className="flex-1 p-2 border rounded bg-gray-100"
                              value={
                                Array.isArray(entry.value) &&
                                entry.value.length > 0 &&
                                typeof entry.value[0] === "string"
                                  ? entry.value[0].substring(0, 50) +
                                    (entry.value[0].length > 50 ? "..." : "")
                                  : ""
                              }
                              readOnly
                              placeholder="Click edit to add HTML content (array)"
                            />
                            <button
                              type="button"
                              onClick={() => openHtmlModal(key)}
                              className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1 transition-colors"
                            >
                              <BiEdit size={16} />
                              Edit HTML Array
                            </button>
                          </div>
                        </>
                      ) : (
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
                            const input =
                              localInputValues[key] ?? e.target.value;

                            const rawItems = input
                              .split(",")

                              .map((item) =>
                                item.trim().replace(/\s{2,}/g, " "),
                              )
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
                      )
                    ) : type.endsWith("_array") &&
                      (key === "calibration_points" ||
                        key === "validation_points") ? (
                      <input
                        type="text"
                        className="w-full p-2 border rounded mt-2"
                        placeholder={`Escribe ${label.toLowerCase()}`}
                        // 2. El valor del input es el texto temporal si existe,
                        //    o el valor del estado principal formateado si no.
                        value={
                          localInputValues[key] ?? // El operador '??' es clave aquí
                          (Array.isArray(entry.value)
                            ? JSON.stringify(entry.value)
                                // .slice(1, -1)
                                .replace(/],\[/g, "], [")
                            : "")
                        }
                        onChange={(e) => {
                          // 3. onChange actualiza el estado de texto TEMPORAL.
                          setLocalInputValues((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }));
                        }}
                        onBlur={() => {
                          // 4. onBlur lee el texto temporal, lo procesa y actualiza el estado PRINCIPAL.
                          const input = localInputValues[key];

                          // Si no hay nada en el estado local, no hagas nada.
                          if (input === undefined) return;

                          if (input.trim() === "") {
                            const newValue = {
                              source: "typed" as const,
                              value: [],
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

                          let finalValue;
                          try {
                            // Si el usuario ya puso los corchetes exteriores
                            finalValue = JSON.parse(input.trim());
                            const newValue = {
                              source: "typed" as const,
                              value: finalValue,
                            };
                            setColumnMapping((prev) => ({
                              ...prev,
                              [key]: newValue,
                            }));
                            if (onSave) {
                              setTimeout(() => onSave(key, newValue), 100);
                            }
                          } catch {
                            try {
                              finalValue = JSON.parse(`[${input.trim()}]`);
                              const newValue = {
                                source: "typed" as const,
                                value: finalValue,
                              };
                              setColumnMapping((prev) => ({
                                ...prev,
                                [key]: newValue,
                              }));
                              if (onSave) {
                                setTimeout(() => onSave(key, newValue), 100);
                              }
                              // Limpia el valor temporal después de un guardado exitoso
                              setLocalInputValues((prev) => {
                                const newState = { ...prev };
                                delete newState[key];
                                return newState;
                              });
                            } catch (error) {
                              console.error("Input format error:", error);
                              // No actualices si hay error, el texto incorrecto
                              // permanecerá en el input para que el usuario lo corrija.
                            }
                          }
                        }}
                      />
                    ) : type === "object" && key !== "coordinates" ? (
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
                            [key]: newValue,
                          }));
                        }}
                        onBlur={(e) => {
                          const input = e.target.value.trim();
                          let finalValue;
                          try {
                            // eslint-disable-next-line no-new-func
                            finalValue = Function(
                              '"use strict";return (' + input + ")",
                            )();
                          } catch (err) {
                            // Si falla, deja el texto como string
                            finalValue = input;
                          }
                          const newValue = {
                            source: "typed" as const,
                            value: finalValue,
                          };
                          setColumnMapping((prev) => ({
                            ...prev,
                            [key]: newValue,
                          }));
                          if (onSave) {
                            setTimeout(() => onSave(key, newValue), 100);
                          }
                        }}
                      />
                    ) : type === "function" ? (
                      key === "button_html" ? (
                        <>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              className="flex-1 p-2 border rounded bg-gray-100"
                              value={
                                typeof entry.value === "string"
                                  ? entry.value.substring(0, 50) +
                                    (entry.value.length > 50 ? "..." : "")
                                  : ""
                              }
                              readOnly
                              placeholder="Click edit to design button template"
                            />
                            <button
                              type="button"
                              onClick={() => openButtonModal(key)}
                              className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1 transition-colors"
                            >
                              <BiEdit size={16} />
                              Design Button
                            </button>
                          </div>
                        </>
                      ) : (
                        <textarea
                          className="w-full p-2 border rounded mt-2 font-mono"
                          rows={4}
                          placeholder={`Type a function for ${label.toLowerCase()}`}
                          value={
                            typeof entry.value === "string" ? entry.value : ""
                          }
                          onChange={(e) => {
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
                          }}
                        />
                      )
                    ) : type === "object" && key === "coordinates" ? (
                      <>
                        <label className="block mt-2">x:</label>
                        <input
                          type="number"
                          min={-1}
                          max={1}
                          step="any"
                          className="w-full p-2 border rounded mt-1"
                          value={
                            entry.value &&
                            typeof entry.value === "object" &&
                            "x" in entry.value &&
                            typeof (entry.value as any).x === "number"
                              ? (entry.value as any).x
                              : 0
                          }
                          onChange={(e) => {
                            const rawValue = Number(e.target.value);
                            const clampedValue = Math.max(
                              -1,
                              Math.min(1, rawValue),
                            );
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
                            entry.value &&
                            typeof entry.value === "object" &&
                            "y" in entry.value &&
                            typeof (entry.value as any).y === "number"
                              ? (entry.value as any).y
                              : 0
                          }
                          onChange={(e) => {
                            const rawValue = Number(e.target.value);
                            const clampedValue = Math.max(
                              -1,
                              Math.min(1, rawValue),
                            );
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
                          }}
                        />
                      </>
                    ) : (
                      <input
                        type="text"
                        className="w-full p-2 border rounded mt-2"
                        placeholder={`Type a value for ${label.toLowerCase()}`}
                        value={
                          typeof entry.value === "string" ||
                          typeof entry.value === "number"
                            ? entry.value
                            : ""
                        }
                        onChange={(e) => {
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
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
      </div>

      {/* HTML Modal */}
      <GrapesHtmlEditor
        isOpen={isHtmlModalOpen}
        onClose={closeHtmlModal}
        title={`Edit HTML Content - ${parameters.find((p) => p.key === currentHtmlKey)?.label || ""}`}
        value={(() => {
          const param = parameters.find((p) => p.key === currentHtmlKey);
          const currentValue = columnMapping[currentHtmlKey]?.value;
          if (param?.type === "html_string_array") {
            return Array.isArray(currentValue) &&
              currentValue.length > 0 &&
              typeof currentValue[0] === "string"
              ? currentValue[0]
              : "";
          }
          return typeof currentValue === "string" ? currentValue : "";
        })()}
        onChange={handleHtmlChange}
        onAutoSave={handleHtmlChange}
      />

      {/* Button HTML Modal */}
      <GrapesButtonEditor
        isOpen={isButtonModalOpen}
        onClose={closeButtonModal}
        title={`Design Button Template - ${parameters.find((p) => p.key === currentButtonKey)?.label || ""}`}
        value={(() => {
          const currentValue = columnMapping[currentButtonKey]?.value;
          if (typeof currentValue === "string") {
            // Extract the button templates from the function string
            // Expected format: (choice, choice_index) => { const templates = [...]; return templates[choice_index] || templates[0]; }
            const match = currentValue.match(/const templates = (\[.*?\]);/);
            if (match && match[1]) {
              try {
                const templates = JSON.parse(match[1]);
                // Wrap buttons in a container div
                return `<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">${templates.join("")}</div>`;
              } catch (e) {
                console.error("Error parsing button templates:", e);
              }
            }
          }
          return '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;"><button style="padding:10px 20px;border-radius:6px;background:#3b82f6;color:white;border:none;font-weight:600;cursor:pointer;">Option 1</button><button style="padding:10px 20px;border-radius:6px;background:#10b981;color:white;border:none;font-weight:600;cursor:pointer;">Option 2</button><button style="padding:10px 20px;border-radius:6px;background:#f59e0b;color:white;border:none;font-weight:600;cursor:pointer;">Option 3</button></div>';
        })()}
        onChange={handleButtonHtmlChange}
        onAutoSave={handleButtonHtmlChange}
      />

      {/* Survey Builder Modal */}
      <SurveyBuilder
        isOpen={isSurveyModalOpen}
        onClose={closeSurveyModal}
        title={`Design Survey - ${parameters.find((p) => p.key === currentSurveyKey)?.label || ""}`}
        value={columnMapping[currentSurveyKey]?.value || {}}
        onChange={handleSurveyChange}
        onAutoSave={handleSurveyChange}
        uploadedFiles={uploadedFiles}
      />
    </div>
  );
};

export default ParameterMapper;
