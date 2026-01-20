import Switch from "react-switch";
import { BiEdit } from "react-icons/bi";
import { ColumnMappingEntry } from "..";
import ObjectInput from "./ObjectInput";
import ObjectCoordsInput from "./ObjectCoordsInput";
import TextInput from "./TextInput";
import FunctionInput from "./FunctionInput";
import WebgazerInput from "./WebGazerInput";
import ArrayInput from "./ArrayInput";

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
          <ArrayInput
            localInputValues={localInputValues}
            setLocalInputValues={setLocalInputValues}
            setColumnMapping={setColumnMapping}
            label={label}
            key={key}
            entry={entry}
            type={type}
          />
        )
      ) : type.endsWith("_array") &&
        (key === "calibration_points" || key === "validation_points") ? (
        <WebgazerInput
          localInputValues={localInputValues}
          setLocalInputValues={setLocalInputValues}
          setColumnMapping={setColumnMapping}
          label={label}
          key={key}
          entry={entry}
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
