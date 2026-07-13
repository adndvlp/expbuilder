import type React from "react";
import ParameterInputField from "../ParameterInputField";
import TypedParameterInput from "../TypedParameterInput";
import {
  getVisualDefaultValue,
  isVisualStyleParameter,
} from "../TypedParameterInput/VisualStyleInput";
import {
  fieldStyle as INSPECTOR_FIELD_STYLE,
  labelStyle as INSPECTOR_LABEL_STYLE,
  selectStyle as INSPECTOR_SELECT_STYLE,
} from "../inspector/styles";
import {
  getInspectorParameterLabel,
  shouldFillInspectorRow,
} from "../inspector/parameterLayout";
import type {
  ColumnMappingEntry,
  Parameter,
  ParameterMapperProps,
} from "../types";

interface Props {
  columnMapping: Record<string, ColumnMappingEntry>;
  componentMode: boolean;
  csvColumns: string[];
  localInputValues: Record<string, string>;
  onSave: ParameterMapperProps["onSave"];
  openButtonModal: (key: string) => void;
  openHtmlModal: (key: string) => void;
  openSurveyModal: (key: string) => void;
  parameter: Parameter;
  setColumnMapping: ParameterMapperProps["setColumnMapping"];
  setLocalInputValues: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}

export default function ParameterControl({
  columnMapping,
  componentMode,
  csvColumns,
  localInputValues,
  onSave,
  openButtonModal,
  openHtmlModal,
  openSurveyModal,
  parameter: { label, key, type },
  setColumnMapping,
  setLocalInputValues,
}: Props) {
  const displayLabel = getInspectorParameterLabel(key, label);
  const rawEntry = columnMapping[key] || { source: "none" };
  const isVisualStyle = componentMode && isVisualStyleParameter(key, type);
  const entry =
    isVisualStyle && rawEntry.source !== "typed"
      ? {
          source: "typed" as const,
          value: getVisualDefaultValue(key, type),
        }
      : rawEntry;
  const fieldStyle = componentMode
    ? {
        ...INSPECTOR_FIELD_STYLE,
        gridColumn: shouldFillInspectorRow(key) ? "1 / -1" : undefined,
      }
    : undefined;

  // ── Special: Dynamic CSV diagnostics → controlled per trial ──
  if (key === "dynamic_csv_diagnostics") {
    const DYNAMIC_CSV_DIAGNOSTIC_OPTIONS = [
      { value: "off", label: "Off - clean CSV" },
      { value: "summary", label: "Summary - quality fields" },
      { value: "full", label: "Full - benchmark/debug" },
    ];
    const currentMode =
      (entry.source === "typed" ? (entry.value as string) : null) ?? "off";
    return (
      <div key={key} style={fieldStyle}>
        <label
          className={componentMode ? "" : "mb-2 mt-3 block text-sm font-medium"}
          style={componentMode ? INSPECTOR_LABEL_STYLE : {}}
        >
          Dynamic CSV Audit Data
        </label>
        <select
          className={componentMode ? "" : "w-full p-2 border rounded mt-1"}
          value={currentMode}
          onChange={(e) => {
            const newValue = {
              source: "typed" as const,
              value: e.target.value,
            };
            setColumnMapping((prev) => ({
              ...prev,
              [key]: newValue,
            }));
            if (onSave) setTimeout(() => onSave(key, newValue), 100);
          }}
          style={
            componentMode
              ? INSPECTOR_SELECT_STYLE
              : { color: "var(--text-dark)" }
          }
        >
          {DYNAMIC_CSV_DIAGNOSTIC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // ── Special: input_type → always show as a select dropdown ──
  if (key === "input_type") {
    const INPUT_TYPE_OPTIONS = [
      { value: "text", label: "Text" },
      { value: "date", label: "Date (calendar)" },
      { value: "time", label: "Time (clock)" },
      { value: "datetime-local", label: "Date & Time" },
      { value: "number", label: "Number" },
      { value: "password", label: "Password" },
    ];
    const currentType =
      (entry.source === "typed" ? (entry.value as string) : null) ?? "text";
    return (
      <div key={key} style={fieldStyle}>
        <label
          className={componentMode ? "" : "mb-2 mt-3 block text-sm font-medium"}
          style={componentMode ? INSPECTOR_LABEL_STYLE : {}}
        >
          {displayLabel}
        </label>
        <select
          className={componentMode ? "" : "w-full p-2 border rounded mt-1"}
          value={currentType}
          onChange={(e) => {
            const newValue = {
              source: "typed" as const,
              value: e.target.value,
            };
            setColumnMapping((prev) => ({
              ...prev,
              [key]: newValue,
            }));
            if (onSave) setTimeout(() => onSave(key, newValue), 100);
          }}
          style={
            componentMode
              ? INSPECTOR_SELECT_STYLE
              : { color: "var(--text-dark)" }
          }
        >
          {INPUT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div key={key} style={fieldStyle}>
      <label
        className={componentMode ? "" : "mb-2 mt-3 block text-sm font-medium"}
        style={componentMode ? INSPECTOR_LABEL_STYLE : {}}
      >
        {displayLabel}
      </label>

      {!isVisualStyle && (
        <ParameterInputField
          entry={entry}
          key={`${key}-field`}
          paramKey={key}
          type={type}
          setColumnMapping={setColumnMapping}
          csvColumns={csvColumns}
          onSave={onSave}
          componentMode={componentMode}
        />
      )}

      {(isVisualStyle || entry.source === "typed") && (
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
          label={displayLabel}
          componentMode={componentMode}
        />
      )}
    </div>
  );
}
