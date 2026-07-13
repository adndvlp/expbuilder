import { useState } from "react";
import TypedParameterInput from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput";
import type { ColumnMappingEntry } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper";

vi.mock("react-switch", () => ({
  default: ({ checked, onChange }: any) => (
    <button type="button" onClick={() => onChange(!checked)}>
      switch {String(checked)}
    </button>
  ),
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ObjectInput",
  () => ({
    default: ({ paramKey }: any) => (
      <div data-testid="object-input">{paramKey}</div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ObjectCoordsInput",
  () => ({
    default: ({ paramKey }: any) => (
      <div data-testid="coords-input">{paramKey}</div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/TextInput",
  () => ({
    default: ({ paramKey }: any) => (
      <div data-testid="text-input">{paramKey}</div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ColorInput",
  () => ({
    default: ({ paramKey }: any) => (
      <div data-testid="color-input">{paramKey}</div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/FunctionInput",
  () => ({
    default: ({ paramKey }: any) => (
      <div data-testid="function-input">{paramKey}</div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/WebgazerInput",
  () => ({
    default: ({ paramKey }: any) => (
      <div data-testid="webgazer-input">{paramKey}</div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ArrayInput",
  () => ({
    default: ({ paramKey, type }: any) => (
      <div data-testid="array-input">{`${paramKey}:${type}`}</div>
    ),
  }),
);

export type HarnessProps = {
  paramKey: string;
  type: string;
  entry?: ColumnMappingEntry;
  onSave?: (key: string, value: any) => void;
  openHtmlModal?: (key: string) => void;
  openButtonModal?: (key: string) => void;
  openSurveyModal?: (key: string) => void;
  componentMode?: boolean;
};

export function Harness({
  paramKey,
  type,
  entry = { source: "typed", value: "" },
  onSave,
  openHtmlModal = vi.fn(),
  openButtonModal = vi.fn(),
  openSurveyModal = vi.fn(),
  componentMode = false,
}: HarnessProps) {
  const [mapping, setMapping] = useState<Record<string, ColumnMappingEntry>>({
    [paramKey]: entry,
  });
  const [localInputValues, setLocalInputValues] = useState<
    Record<string, string>
  >({});
  const effectiveEntry = mapping[paramKey] ?? entry;

  return (
    <>
      <TypedParameterInput
        paramKey={paramKey}
        type={type}
        entry={effectiveEntry}
        setColumnMapping={setMapping}
        onSave={onSave}
        openHtmlModal={openHtmlModal}
        openButtonModal={openButtonModal}
        openSurveyModal={openSurveyModal}
        localInputValues={localInputValues}
        setLocalInputValues={setLocalInputValues}
        label="Stimulus"
        componentMode={componentMode}
      />
      <output data-testid="mapping">{JSON.stringify(effectiveEntry)}</output>
      <output data-testid="locals">{JSON.stringify(localInputValues)}</output>
    </>
  );
}
