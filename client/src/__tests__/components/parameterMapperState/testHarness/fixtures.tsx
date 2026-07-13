import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import ParameterMapper, {
  type ColumnMappingEntry,
  type Parameter,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper";
import ParameterInputField from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInputField";
import useAutoSaveHandlers from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/useAutoSaveHandlers";
import useParameterModals from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/useParameterModals";
import { useColumnMapping } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useColumnMapping";
import { useTrialPersistence } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useTrialPersistence";

type Mapping = Record<string, ColumnMappingEntry>;

function ParameterInputFieldHarness({
  initialMapping = {},
  paramKey,
  type,
  csvColumns = [],
  onSave,
}: {
  initialMapping?: Mapping;
  paramKey: string;
  type: string;
  csvColumns?: string[];
  onSave?: (key: string, value: unknown) => void;
}) {
  const [mapping, setMapping] = useState<Mapping>(initialMapping);

  return (
    <>
      <ParameterInputField
        entry={mapping[paramKey] ?? { source: "none", value: null }}
        paramKey={paramKey}
        type={type}
        setColumnMapping={setMapping}
        csvColumns={csvColumns}
        onSave={onSave}
      />
      <output data-testid="mapping">{JSON.stringify(mapping)}</output>
    </>
  );
}

function ParameterMapperHarness({
  initialMapping,
  onSave,
}: {
  initialMapping: Mapping;
  onSave?: (key: string, value: unknown) => void;
}) {
  const [mapping, setMapping] = useState<Mapping>(initialMapping);
  const parameters: Parameter[] = [
    { key: "input_type", label: "Input Type", type: "string" },
    { key: "text", label: "Cloze Text", type: "string" },
    { key: "check_answers", label: "Check Answers", type: "boolean" },
    { key: "allow_blanks", label: "Allow Blanks", type: "boolean" },
    { key: "case_sensitivity", label: "Case Sensitivity", type: "string" },
    { key: "placeholder", label: "Placeholder", type: "string" },
  ];

  return (
    <>
      <ParameterMapper
        parameters={parameters}
        columnMapping={mapping}
        setColumnMapping={setMapping}
        csvColumns={["placeholder_col"]}
        pluginName="plugin-survey-text"
        componentMode
        onSave={onSave}
      />
      <output data-testid="mapping">{JSON.stringify(mapping)}</output>
    </>
  );
}

function readMapping() {
  return JSON.parse(
    screen.getByTestId("mapping").textContent || "{}",
  ) as Mapping;
}

function useAutoSaveHarness({
  parameters,
  currentHtmlKey = "",
  currentButtonKey = "",
  currentSurveyKey = "",
  onSave,
}: {
  parameters: Parameter[];
  currentHtmlKey?: string;
  currentButtonKey?: string;
  currentSurveyKey?: string;
  onSave?: (key: string, value: unknown) => void;
}) {
  const [columnMapping, setColumnMapping] = useState<Mapping>({});
  const handlers = useAutoSaveHandlers({
    parameters,
    setColumnMapping,
    currentHtmlKey,
    currentButtonKey,
    currentSurveyKey,
    onSave,
  });

  return {
    columnMapping,
    ...handlers,
  };
}

function useTrialPersistenceHarness({
  initialTrials,
  initialSelectedTrial,
}: {
  initialTrials: any[];
  initialSelectedTrial: any;
}) {
  const [trials, setTrials] = useState(initialTrials);
  const [selectedTrial, setSelectedTrial] = useState(initialSelectedTrial);
  const persistence = useTrialPersistence({
    trials,
    setTrials,
    selectedTrial,
    setSelectedTrial,
  });

  return {
    trials,
    selectedTrial,
    ...persistence,
  };
}

export {
  ParameterInputField,
  ParameterInputFieldHarness,
  ParameterMapper,
  ParameterMapperHarness,
  act,
  afterEach,
  describe,
  expect,
  fireEvent,
  it,
  readMapping,
  render,
  renderHook,
  screen,
  useAutoSaveHandlers,
  useAutoSaveHarness,
  useColumnMapping,
  useParameterModals,
  useState,
  useTrialPersistence,
  useTrialPersistenceHarness,
  vi,
  waitFor,
};
export type { ColumnMappingEntry, Mapping, Parameter };
