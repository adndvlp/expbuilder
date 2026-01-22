import React, { useEffect, useState, useRef } from "react";
import { openExternal } from "../../../../../../lib/openExternal";
import { IoIosHelpCircle } from "react-icons/io";
import GrapesHtmlEditor from "../TrialDesigner/GrapesEditors/GrapesHtmlEditor";
import GrapesButtonEditor from "../TrialDesigner/GrapesEditors/GrapesButtonEditor";
import SurveyBuilder from "../TrialDesigner/SurveyEditor";
import isEqual from "lodash.isequal";
import useAutoSaveHandlers from "./useAutoSaveHandlers";
import useParameterModals from "./useParameterModals";
import ParameterInputField from "./ParameterInputField";
import TypedParameterInput from "./TypedParameterInput";

type UploadedFile = { name: string; url: string; type: string };

export type Parameter = {
  label: string;
  key: string;
  type: string;
};

export type ColumnMappingEntry = {
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

  const {
    isHtmlModalOpen,
    currentHtmlKey,
    openHtmlModal,
    closeHtmlModal,
    isButtonModalOpen,
    currentButtonKey,
    openButtonModal,
    closeButtonModal,
    isSurveyModalOpen,
    currentSurveyKey,
    openSurveyModal,
    closeSurveyModal,
  } = useParameterModals();

  const { handleHtmlChange, handleButtonHtmlChange, handleSurveyChange } =
    useAutoSaveHandlers({
      parameters,
      setColumnMapping,
      currentButtonKey,
      currentHtmlKey,
      currentSurveyKey,
    });

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

                <ParameterInputField
                  entry={entry}
                  key={`${key}-field`}
                  paramKey={key}
                  type={type}
                  setColumnMapping={setColumnMapping}
                  csvColumns={csvColumns}
                  onSave={onSave}
                />

                {entry.source === "typed" && (
                  <TypedParameterInput
                    key={`${key}-input`}
                    paramKey={key}
                    type={type}
                    entry={entry}
                    setColumnMapping={setColumnMapping}
                    openHtmlModal={openHtmlModal}
                    openButtonModal={openButtonModal}
                    openSurveyModal={openSurveyModal}
                    onSave={onSave}
                    localInputValues={localInputValues}
                    setLocalInputValues={setLocalInputValues}
                    label={label}
                  />
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
