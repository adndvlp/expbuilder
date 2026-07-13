import React, { useEffect, useState, useRef } from "react";
import { openExternal } from "../../../../../../lib/openExternal";
import { IoIosHelpCircle } from "react-icons/io";
import GrapesHtmlEditor from "../TrialDesigner/GrapesEditors/GrapesHtmlEditor";
import GrapesButtonEditor from "../TrialDesigner/GrapesEditors/GrapesButtonEditor";
import SurveyBuilder from "../TrialDesigner/SurveyEditor";
import isEqual from "lodash.isequal";
import useAutoSaveHandlers from "./useAutoSaveHandlers";
import useParameterModals from "./useParameterModals";
import type { Parameter, ParameterMapperProps } from "./types";
export type { ColumnMappingEntry, Parameter } from "./types";
import {
  getInspectorParameterPriority,
  getInspectorSection,
  sectionLabels as INSPECTOR_SECTION_LABELS,
  sectionOrder as INSPECTOR_SECTION_ORDER,
  type InspectorSection,
} from "./inspector/parameterLayout";
import {
  gridStyle as INSPECTOR_GRID_STYLE,
  panelStyle as INSPECTOR_PANEL_STYLE,
  sectionBodyStyle as INSPECTOR_SECTION_BODY_STYLE,
  sectionHeaderStyle as INSPECTOR_SECTION_HEADER_STYLE,
  sectionStyle as INSPECTOR_SECTION_STYLE,
  sectionTitleStyle as INSPECTOR_SECTION_TITLE_STYLE,
} from "./inspector/styles";
import ParameterControl from "./components/ParameterControl";

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

  // ── input_type live value (used to conditionally hide cloze-only params) ──
  const inputTypeValue: string =
    (columnMapping["input_type"]?.value as string) || "text";

  // Params that are only relevant for cloze (text) mode
  const CLOZE_ONLY_KEYS = new Set([
    "text",
    "check_answers",
    "allow_blanks",
    "case_sensitivity",
  ]);
  // Params hidden for non-text types (date/time/number/email/password/tel don't use cloze)
  const visibleParameters = parameters.filter(({ key }) => {
    if (CLOZE_ONLY_KEYS.has(key) && inputTypeValue !== "text") return false;
    return true;
  });

  const orderedVisibleParameters = componentMode
    ? [...visibleParameters].sort((a, b) => {
        const aPriority = getInspectorParameterPriority(a.key);
        const bPriority = getInspectorParameterPriority(b.key);
        if (aPriority !== bPriority) return aPriority - bPriority;
        return visibleParameters.indexOf(a) - visibleParameters.indexOf(b);
      })
    : visibleParameters;

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
      onSave,
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

  const renderParameterControl = (parameter: Parameter) => (
    <ParameterControl
      key={parameter.key}
      parameter={parameter}
      columnMapping={columnMapping}
      componentMode={componentMode}
      csvColumns={csvColumns}
      localInputValues={localInputValues}
      onSave={onSave}
      openButtonModal={openButtonModal}
      openHtmlModal={openHtmlModal}
      openSurveyModal={openSurveyModal}
      setColumnMapping={setColumnMapping}
      setLocalInputValues={setLocalInputValues}
    />
  );

  const renderInspectorSections = () => {
    const sectionItems = new Map<InspectorSection, React.ReactNode[]>(
      INSPECTOR_SECTION_ORDER.map((section) => [section, []]),
    );

    orderedVisibleParameters.forEach((parameter) => {
      sectionItems
        .get(getInspectorSection(parameter.key))
        ?.push(renderParameterControl(parameter));
    });

    return INSPECTOR_SECTION_ORDER.map((section) => {
      const items = sectionItems.get(section)!;
      if (items.length === 0) return null;

      return (
        <section key={section} style={INSPECTOR_SECTION_STYLE}>
          <div style={INSPECTOR_SECTION_HEADER_STYLE}>
            <h4 style={INSPECTOR_SECTION_TITLE_STYLE}>
              {INSPECTOR_SECTION_LABELS[section]}
            </h4>
          </div>
          <div style={INSPECTOR_SECTION_BODY_STYLE}>{items}</div>
        </section>
      );
    });
  };

  return (
    <div
      className={componentMode ? "" : "mb-4 p-4 border rounded bg-gray-50"}
      style={componentMode ? INSPECTOR_PANEL_STYLE : {}}
    >
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
      <div
        className={componentMode ? "" : "mb-2 grid grid-cols-2 gap-2"}
        style={componentMode ? INSPECTOR_GRID_STYLE : undefined}
      >
        {componentMode
          ? renderInspectorSections()
          : orderedVisibleParameters.map(renderParameterControl)}
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
