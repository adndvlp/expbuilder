/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { screen } from "@testing-library/react";
import { useState } from "react";
import { vi } from "vitest";
import ParameterMapper, {
  type ColumnMappingEntry,
  type Parameter,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper";

const hoistedMocks = vi.hoisted(() => ({
  openExternal: vi.fn(),
}));

vi.mock("../../../lib/openExternal", () => ({
  openExternal: hoistedMocks.openExternal,
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInputField",
  () => ({
    default: ({ paramKey, entry, csvColumns, componentMode }: any) => (
      <div
        data-testid={`field-${paramKey}`}
        data-component-mode={String(componentMode)}
        data-source={entry.source}
      >
        {csvColumns.join(",")}
      </div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput",
  () => ({
    default: ({
      paramKey,
      type,
      entry,
      label,
      openHtmlModal,
      openButtonModal,
      openSurveyModal,
      componentMode,
    }: any) => (
      <div
        data-testid={`typed-${paramKey}`}
        data-component-mode={String(componentMode)}
        data-source={entry.source}
        data-value={JSON.stringify(entry.value)}
      >
        <span>{label}</span>
        {(type === "html_string" || type === "html_string_array") && (
          <button type="button" onClick={() => openHtmlModal(paramKey)}>
            open html {paramKey}
          </button>
        )}
        {paramKey === "button_html" && (
          <button type="button" onClick={() => openButtonModal(paramKey)}>
            open button {paramKey}
          </button>
        )}
        {paramKey === "survey_json" && (
          <button type="button" onClick={() => openSurveyModal(paramKey)}>
            open survey {paramKey}
          </button>
        )}
      </div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/GrapesEditors/GrapesHtmlEditor",
  () => ({
    default: ({ isOpen, title, value, onChange, onAutoSave, onClose }: any) => (
      <div
        data-testid="html-editor"
        data-open={String(isOpen)}
        data-title={title}
        data-value={value}
      >
        <button type="button" onClick={() => onChange("<p>changed</p>")}>
          html change
        </button>
        <button type="button" onClick={() => onAutoSave("<p>saved</p>")}>
          html autosave
        </button>
        <button type="button" onClick={onClose}>
          html close
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/GrapesEditors/GrapesButtonEditor",
  () => ({
    default: ({ isOpen, title, value, onChange, onAutoSave, onClose }: any) => (
      <div
        data-testid="button-editor"
        data-open={String(isOpen)}
        data-title={title}
        data-value={value}
      >
        <button
          type="button"
          onClick={() => onChange("<button>Changed</button>")}
        >
          button change
        </button>
        <button
          type="button"
          onClick={() => onAutoSave("<button>Saved</button>")}
        >
          button autosave
        </button>
        <button type="button" onClick={onClose}>
          button close
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor",
  () => ({
    default: ({
      isOpen,
      title,
      value,
      uploadedFiles,
      onChange,
      onAutoSave,
      onClose,
    }: any) => (
      <div
        data-testid="survey-editor"
        data-open={String(isOpen)}
        data-title={title}
        data-value={JSON.stringify(value)}
        data-files={JSON.stringify(uploadedFiles)}
      >
        <button type="button" onClick={() => onChange({ title: "changed" })}>
          survey change
        </button>
        <button type="button" onClick={() => onAutoSave({ title: "saved" })}>
          survey autosave
        </button>
        <button type="button" onClick={onClose}>
          survey close
        </button>
      </div>
    ),
  }),
);

export type Mapping = Record<string, ColumnMappingEntry>;

export const mocks = hoistedMocks;

export function MapperHarness({
  parameters,
  initialMapping = {},
  componentMode = false,
  onSave,
  pluginName = "plugin-html-button-response",
}: {
  parameters: Parameter[];
  initialMapping?: Mapping;
  componentMode?: boolean;
  onSave?: (key: string, value: unknown) => void;
  pluginName?: string;
}) {
  const [mapping, setMapping] = useState<Mapping>(initialMapping);

  return (
    <>
      <ParameterMapper
        parameters={parameters}
        columnMapping={mapping}
        setColumnMapping={setMapping}
        csvColumns={["csv_a", "csv_b"]}
        pluginName={pluginName}
        componentMode={componentMode}
        uploadedFiles={[
          { name: "img.png", url: "/img.png", type: "image/png" },
        ]}
        onSave={onSave}
      />
      <output data-testid="mapping">{JSON.stringify(mapping)}</output>
    </>
  );
}

export function readMapping() {
  return JSON.parse(
    screen.getByTestId("mapping").textContent || "{}",
  ) as Mapping;
}

export function getSelectByValue(value: string) {
  return screen
    .getAllByRole("combobox")
    .find((select) => (select as HTMLSelectElement).value === value) as
    | HTMLSelectElement
    | undefined;
}
