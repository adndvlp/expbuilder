import Switch from "react-switch";
import { BiEdit } from "react-icons/bi";
import { ColumnMappingEntry } from "..";
import ObjectInput from "./ObjectInput";
import ObjectCoordsInput from "./ObjectCoordsInput";
import TextInput from "./TextInput";
import FunctionInput from "./FunctionInput";

type Props = {
  key: string;
  type: string;
  entry: ColumnMappingEntry;
  setColumnMapping: React.Dispatch<
    React.SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  onSave?: ((key: string, value: any) => void) | undefined;
  openHtmlModal: (key: string) => void;
  openButtonModal: (key: string) => void;
  openSurveyModal: (key: string) => void;
  localInputValues: Record<string, string>;
  setLocalInputValues: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  label: string;
};

function index({
  key,
  type,
  entry,
  setColumnMapping,
  onSave,
  openHtmlModal,
  openButtonModal,
  openSurveyModal,
  localInputValues,
  setLocalInputValues,
  label,
}: Props) {
  return (
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
          <span style={{ fontWeight: 500, color: "var(--text-dark)" }}>
            {entry.value === true ? "True" : "False"}
          </span>
        </div>
      ) : type === "html_string" ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              className="flex-1 p-2 border rounded bg-gray-100"
              value={typeof entry.value === "string" ? entry.value : ""}
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
            setLocalInputValues((prev) => {
              const newState = { ...prev };
              delete newState[key];
              return newState;
            });
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
              const input = localInputValues[key] ?? e.target.value;

              const rawItems = input
                .split(",")

                .map((item) => item.trim().replace(/\s{2,}/g, " "))
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
        (key === "calibration_points" || key === "validation_points") ? (
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
        <ObjectInput
          key={key}
          entry={entry}
          setColumnMapping={setColumnMapping}
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
          <FunctionInput
            localInputValues={localInputValues}
            label={label}
            setLocalInputValues={setLocalInputValues}
            entry={entry}
            key={key}
            setColumnMapping={setColumnMapping}
          />
        )
      ) : type === "object" && key === "coordinates" ? (
        <ObjectCoordsInput
          localInputValues={localInputValues}
          entry={entry}
          key={key}
          setLocalInputValues={setLocalInputValues}
          setColumnMapping={setColumnMapping}
        />
      ) : (
        <TextInput
          localInputValues={localInputValues}
          setColumnMapping={setColumnMapping}
          key={key}
          entry={entry}
          label={label}
          setLocalInputValues={setLocalInputValues}
        />
      )}
    </>
  );
}

export default index;
