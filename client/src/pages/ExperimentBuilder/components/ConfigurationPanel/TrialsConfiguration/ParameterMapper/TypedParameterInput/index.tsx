import { BiEdit } from "react-icons/bi";
import ObjectInput from "./ObjectInput";
import ObjectCoordsInput from "./ObjectCoordsInput";
import TextInput from "./TextInput";
import ColorInput from "./ColorInput";
import FunctionInput from "./FunctionInput";
import WebgazerInput from "./WebgazerInput";
import ArrayInput from "./ArrayInput";
import VisualStyleInput, {
  isVisualColorParameter,
  isVisualStyleParameter,
} from "./VisualStyleInput";
import BooleanInput from "./BooleanInput";
import NumberInput from "./NumberInput";
import { inspectorTextInputStyle as INSPECTOR_TEXT_INPUT_STYLE } from "./styles";
import type { TypedParameterInputProps as Props } from "./types";

function index({
  paramKey,
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
  componentMode = false,
}: Props) {
  return (
    <>
      {type === "boolean" ? (
        <BooleanInput
          entry={entry}
          onSave={onSave}
          paramKey={paramKey}
          setColumnMapping={setColumnMapping}
        />
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
              onClick={() => openHtmlModal(paramKey)}
              className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1 transition-colors"
            >
              <BiEdit size={16} />
              Edit
            </button>
          </div>
        </>
      ) : type === "object" && paramKey === "survey_json" ? (
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
              onClick={() => openSurveyModal(paramKey)}
              className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1 transition-colors"
            >
              <BiEdit size={16} />
              Design Survey
            </button>
          </div>
        </>
      ) : type === "string" && isVisualColorParameter(paramKey) ? (
        <ColorInput
          onSave={onSave}
          localInputValues={localInputValues}
          setColumnMapping={setColumnMapping}
          paramKey={paramKey}
          entry={entry}
          label={label}
          setLocalInputValues={setLocalInputValues}
        />
      ) : isVisualStyleParameter(paramKey, type) ? (
        <VisualStyleInput
          onSave={onSave}
          localInputValues={localInputValues}
          setColumnMapping={setColumnMapping}
          paramKey={paramKey}
          type={type}
          entry={entry}
          label={label}
          setLocalInputValues={setLocalInputValues}
        />
      ) : type === "number" ? (
        <NumberInput
          componentMode={componentMode}
          entry={entry}
          localInputValues={localInputValues}
          onSave={onSave}
          paramKey={paramKey}
          setColumnMapping={setColumnMapping}
          setLocalInputValues={setLocalInputValues}
        />
      ) : type.endsWith("_array") &&
        paramKey !== "calibration_points" &&
        paramKey !== "validation_points" ? (
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
                onClick={() => openHtmlModal(paramKey)}
                className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1 transition-colors"
              >
                <BiEdit size={16} />
                Edit HTML Array
              </button>
            </div>
          </>
        ) : (
          <ArrayInput
            onSave={onSave}
            localInputValues={localInputValues}
            setLocalInputValues={setLocalInputValues}
            setColumnMapping={setColumnMapping}
            label={label}
            paramKey={paramKey}
            entry={entry}
            type={type}
            componentMode={componentMode}
          />
        )
      ) : type.endsWith("_array") &&
        (paramKey === "calibration_points" ||
          paramKey === "validation_points") ? (
        <WebgazerInput
          localInputValues={localInputValues}
          setLocalInputValues={setLocalInputValues}
          setColumnMapping={setColumnMapping}
          label={label}
          paramKey={paramKey}
          entry={entry}
        />
      ) : type === "object" && paramKey !== "coordinates" ? (
        <ObjectInput
          onSave={onSave}
          paramKey={paramKey}
          entry={entry}
          setColumnMapping={setColumnMapping}
        />
      ) : type === "function" ? (
        paramKey === "button_html" ? (
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
                onClick={() => openButtonModal(paramKey)}
                className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1 transition-colors"
              >
                <BiEdit size={16} />
                Design Button
              </button>
            </div>
          </>
        ) : (
          <FunctionInput
            onSave={onSave}
            localInputValues={localInputValues}
            label={label}
            setLocalInputValues={setLocalInputValues}
            entry={entry}
            paramKey={paramKey}
            setColumnMapping={setColumnMapping}
          />
        )
      ) : type === "object" && paramKey === "coordinates" ? (
        <ObjectCoordsInput
          onSave={onSave}
          localInputValues={localInputValues}
          entry={entry}
          paramKey={paramKey}
          setLocalInputValues={setLocalInputValues}
          setColumnMapping={setColumnMapping}
          componentMode={componentMode}
        />
      ) : type === "string" && paramKey === "text" ? (
        <textarea
          rows={4}
          className={
            componentMode
              ? "resize-y"
              : "w-full p-2 border rounded mt-2 resize-y"
          }
          style={
            componentMode
              ? {
                  ...INSPECTOR_TEXT_INPUT_STYLE,
                  minHeight: 92,
                  fontFamily: "inherit",
                  fontSize: 13,
                  lineHeight: 1.45,
                }
              : { fontFamily: "inherit", fontSize: 13 }
          }
          value={
            localInputValues[paramKey] ??
            (typeof entry.value === "string" ? entry.value : "")
          }
          onChange={(e) => {
            setLocalInputValues((prev) => ({
              ...prev,
              [paramKey]: e.target.value,
            }));
          }}
          onBlur={(e) => {
            const newValue = {
              source: "typed" as const,
              value: e.target.value,
            };
            setColumnMapping((prev) => ({ ...prev, [paramKey]: newValue }));
            if (onSave) setTimeout(() => onSave(paramKey, newValue), 100);
            setLocalInputValues((prev) => {
              const s = { ...prev };
              delete s[paramKey];
              return s;
            });
          }}
          placeholder="Enter text content..."
        />
      ) : (
        <TextInput
          onSave={onSave}
          localInputValues={localInputValues}
          setColumnMapping={setColumnMapping}
          paramKey={paramKey}
          entry={entry}
          label={label}
          setLocalInputValues={setLocalInputValues}
          componentMode={componentMode}
        />
      )}
    </>
  );
}

export default index;
