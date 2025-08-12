import React, { useEffect, useState } from "react";
import { IoIosHelpCircle } from "react-icons/io";
import HtmlMapper from "./HtmlMapper";
import { BiEdit } from "react-icons/bi";
import Modal from "./Modal";

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
};

const ParameterMapper: React.FC<ParameterMapperProps> = ({
  parameters,
  columnMapping,
  setColumnMapping,
  csvColumns,
  pluginName,
}) => {
  const pluginLink = () => {
    let pluginUrl = pluginName
      .replace(/^plugin-/, "")
      .replace(/$/, "#parameters");
    return `https://www.jspsych.org/latest/plugins/${pluginUrl}`;
  };

  const [localInputValues, setLocalInputValues] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    // Esta función se asegura de que el estado de mapeo esté completamente poblado.
    setColumnMapping((prevMapping) => {
      const updatedMapping = { ...prevMapping };
      let needsUpdate = false;

      // Itera sobre todos los parámetros que debería mostrar el componente.
      parameters.forEach((param) => {
        // Si un parámetro NO tiene una entrada en el estado de mapeo...
        if (!updatedMapping[param.key]) {
          // ...lo inicializamos con la configuración por defecto 'none'.
          updatedMapping[param.key] = { source: "none", value: null };
          needsUpdate = true;
        }
      });

      // Si hicimos cambios, devolvemos el nuevo objeto para actualizar el estado.
      // Si no, devolvemos el objeto original para evitar un re-render innecesario.
      return needsUpdate ? updatedMapping : prevMapping;
    });
  }, [parameters, setColumnMapping]);

  // Modal
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const [currentHtmlKey, setCurrentHtmlKey] = useState<string>("");

  const openHtmlModal = (key: string) => {
    setCurrentHtmlKey(key);
    setIsHtmlModalOpen(true);
  };

  const closeHtmlModal = () => {
    setIsHtmlModalOpen(false);
    setCurrentHtmlKey("");
  };

  const handleHtmlChange = (htmlValue: string) => {
    if (currentHtmlKey) {
      setColumnMapping((prev) => ({
        ...prev,
        [currentHtmlKey]: {
          source: "typed",
          value: htmlValue,
        },
      }));
    }
  };

  // Modal

  return (
    <div className="mb-4 p-4 border rounded bg-gray-50">
      <a
        style={{
          color: "white",
          display: "flex",
          justifyContent: "flex-end",
          top: "0px",
          right: "0px",
          width: "16px",
        }}
        target="_blank"
        href={pluginLink()}
      >
        <IoIosHelpCircle />
      </a>
      <h4 className="mb-2 text-center ">Plugin parameters</h4>

      <div className="mb-2 grid grid-cols-2 gap-2">
        {parameters.map(({ label, key, type }) => {
          const entry = columnMapping[key] || { source: "none" };
          // console.log(JSON.stringify(parameters));

          const handleTypedValueChange = (value: any) => {
            setColumnMapping((prev) => ({
              ...prev,
              [key]: {
                source: "typed",
                value,
              },
            }));
          };

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
                      : ""
                }
                onChange={(e) => {
                  const value = e.target.value;
                  const source =
                    value === "type_value"
                      ? "typed"
                      : value === ""
                        ? "none"
                        : "csv";

                  setColumnMapping((prev) => ({
                    ...prev,
                    [key]: {
                      source,
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
                    },
                  }));
                }}
                className="w-full p-2 border rounded"
              >
                <option value="">Default value</option>
                <option value="type_value">Type value</option>
                {csvColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>

              {entry.source === "typed" && (
                <>
                  {type === "boolean" ? (
                    <select
                      className="mt-2 p-2 border rounded"
                      value={entry.value === true ? "true" : "false"}
                      onChange={(e) =>
                        handleTypedValueChange(e.target.value === "true")
                      }
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : type === "html_string" ? (
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
                        handleTypedValueChange(rawValue);
                      }}
                    />
                  ) : type.endsWith("_array") &&
                    key !== "calibration_points" &&
                    key !== "validation_points" ? (
                    <input
                      type="text"
                      className="w-full p-2 border rounded mt-2"
                      placeholder={`Comma-separated values for ${label.toLowerCase()}`}
                      value={
                        typeof entry.value === "string"
                          ? entry.value
                          : Array.isArray(entry.value)
                            ? entry.value.join(", ")
                            : ""
                      }
                      onChange={(e) => {
                        handleTypedValueChange(e.target.value);
                      }}
                      onBlur={(e) => {
                        const input = e.target.value.trim();
                        const rawItems = input
                          .split(",")
                          .map((item) => item.trim())
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
                            case "bool":
                              const lower = item.toLowerCase();
                              if (lower === "true") return true;
                              if (lower === "false") return false;
                              return item;
                            default:
                              return item;
                          }
                        });

                        handleTypedValueChange(castedArray);
                      }}
                    />
                  ) : (type.endsWith("_array") &&
                      key === "calibration_points") ||
                    key === "validation_points" ? (
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
                          handleTypedValueChange([]);
                          return;
                        }

                        let finalValue;
                        try {
                          // Si el usuario ya puso los corchetes exteriores
                          finalValue = JSON.parse(input.trim());
                          handleTypedValueChange(finalValue);
                        } catch {
                          try {
                            finalValue = JSON.parse(`[${input.trim()}]`);
                            handleTypedValueChange(finalValue);
                            // Limpia el valor temporal después de un guardado exitoso
                            setLocalInputValues((prev) => {
                              const newState = { ...prev };
                              delete newState[key];
                              return newState;
                            });
                          } catch (error) {
                            console.error(
                              "Error de formato en el input:",
                              error
                            );
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
                      onChange={(e) => handleTypedValueChange(e.target.value)}
                      onBlur={(e) => {
                        const input = e.target.value.trim();
                        try {
                          // eslint-disable-next-line no-new-func
                          const obj = Function(
                            '"use strict";return (' + input + ")"
                          )();
                          handleTypedValueChange(obj);
                        } catch (err) {
                          // Si falla, deja el texto como string (o muestra un error si prefieres)
                          handleTypedValueChange(input);
                        }
                      }}
                    />
                  ) : type === "function" ? (
                    <textarea
                      className="w-full p-2 border rounded mt-2 font-mono"
                      rows={4}
                      placeholder={`Type a function for ${label.toLowerCase()}`}
                      value={typeof entry.value === "string" ? entry.value : ""}
                      onChange={(e) => handleTypedValueChange(e.target.value)}
                    />
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
                            Math.min(1, rawValue)
                          );
                          handleTypedValueChange({
                            ...(entry.value &&
                            typeof entry.value === "object" &&
                            "x" in entry.value &&
                            "y" in entry.value
                              ? entry.value
                              : { x: 0, y: 0 }),
                            x: clampedValue,
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
                            Math.min(1, rawValue)
                          );
                          handleTypedValueChange({
                            ...(entry.value &&
                            typeof entry.value === "object" &&
                            "x" in entry.value &&
                            "y" in entry.value
                              ? entry.value
                              : { x: 0, y: 0 }),
                            y: clampedValue,
                          });
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
                      onChange={(e) => handleTypedValueChange(e.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {/* HTML Modal */}
      <Modal
        isOpen={isHtmlModalOpen}
        onClose={closeHtmlModal}
        title={`Edit HTML Content - ${parameters.find((p) => p.key === currentHtmlKey)?.label || ""}`}
      >
        {currentHtmlKey && (
          <HtmlMapper
            value={
              typeof columnMapping[currentHtmlKey]?.value === "string"
                ? columnMapping[currentHtmlKey].value
                : ""
            }
            onChange={handleHtmlChange}
            placeholder={`Enter HTML content for ${parameters.find((p) => p.key === currentHtmlKey)?.label?.toLowerCase()}`}
          />
        )}
      </Modal>
    </div>
  );
};

export default ParameterMapper;
