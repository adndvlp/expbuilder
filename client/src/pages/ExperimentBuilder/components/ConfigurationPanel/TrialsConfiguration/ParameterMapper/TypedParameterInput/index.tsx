import Switch from "react-switch";
import { BiEdit } from "react-icons/bi";
import { ColumnMappingEntry } from "..";
import ObjectInput from "./ObjectInput";
import ObjectCoordsInput from "./ObjectCoordsInput";
import TextInput from "./TextInput";
import ColorInput from "./ColorInput";
import FunctionInput from "./FunctionInput";
import WebgazerInput from "./WebgazerInput";
import ArrayInput from "./ArrayInput";

type Props = {
  paramKey: string;
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
                [paramKey]: newValue,
              }));
              if (onSave) {
                setTimeout(() => onSave(paramKey, newValue), 100);
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
      ) : type === "number" ? (
        <input
          type="number"
          min={0}
          step="any"
          className="w-full p-2 border rounded mt-2"
          value={
            localInputValues[paramKey] ??
            (typeof entry.value === "string" || typeof entry.value === "number"
              ? entry.value
              : "")
          }
          onChange={(e) => {
            setLocalInputValues((prev) => ({
              ...prev,
              [paramKey]: e.target.value,
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
              [paramKey]: newValue,
            }));
            if (onSave) {
              setTimeout(() => onSave(paramKey, newValue), 100);
            }
            setLocalInputValues((prev) => {
              const newState = { ...prev };
              delete newState[paramKey];
              return newState;
            });
          }}
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
        />
      ) : type === "string" && paramKey.endsWith("_color") ? (
        <ColorInput
          onSave={onSave}
          localInputValues={localInputValues}
          setColumnMapping={setColumnMapping}
          paramKey={paramKey}
          entry={entry}
          label={label}
          setLocalInputValues={setLocalInputValues}
        />
      ) : type === "string" && paramKey === "text" ? (
        <textarea
          rows={4}
          className="w-full p-2 border rounded mt-2 resize-y"
          style={{ fontFamily: "inherit", fontSize: 13 }}
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
        />
      )}
    </>
  );
}

export default index;
