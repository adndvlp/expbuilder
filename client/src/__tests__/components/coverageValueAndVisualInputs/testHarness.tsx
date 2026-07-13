import { render } from "@testing-library/react";
import { expect, vi } from "vitest";
import ColumnValue from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride/ColumnValue";
import VisualStyleInput from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/VisualStyleInput";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput",
  () => ({
    ParameterInput: ({ paramKey, value, onChange }: any) => (
      <button
        type="button"
        data-testid={`parameter-input-${paramKey}`}
        onClick={() => onChange(`${value ?? ""}-updated`)}
      >
        parameter input {paramKey}
      </button>
    ),
  }),
);

function normalCondition() {
  return {
    id: 1,
    nextTrialId: "target",
    customParameters: {
      enabled: { source: "typed", value: true },
      duration: { source: "typed", value: 5 },
      label: { source: "typed", value: "Go" },
    },
  } as any;
}

export function renderColumnValue(overrides: Record<string, unknown> = {}) {
  const condition = normalCondition();
  const props = {
    isTargetDynamic: false,
    fieldType: "",
    componentIdx: "",
    propName: "",
    comp: null,
    questionName: "",
    paramValue: { source: "typed", value: true },
    setConditions: vi.fn(),
    conditions: [condition, { id: 2, customParameters: { keep: true } }],
    parametersArray: [
      {
        key: "text",
        label: "Text",
        type: "string",
        default: "",
        description: "",
      },
      {
        key: "survey_json",
        label: "Survey JSON",
        type: "object",
        default: {},
        description: "",
      },
    ],
    availableParams: [
      { key: "enabled", label: "Enabled", type: "boolean" },
      { key: "duration", label: "Duration", type: "number" },
      { key: "label", label: "Label", type: "string" },
      { key: "tags", label: "Tags", type: "string_array" },
    ],
    condition,
    targetTrialCsvColumns: { target: ["score", "answer"] },
    paramKey: "enabled",
    triggerSave: vi.fn(),
    ...overrides,
  };

  render(
    <table>
      <tbody>
        <tr>
          <ColumnValue {...(props as any)} />
        </tr>
      </tbody>
    </table>,
  );

  return props;
}

export function renderVisualInput(overrides: Record<string, unknown> = {}) {
  const props = {
    localInputValues: {},
    setColumnMapping: vi.fn(),
    paramKey: "font_size",
    type: "number",
    entry: { source: "typed", value: 16 },
    label: "Font size",
    onSave: vi.fn(),
    setLocalInputValues: vi.fn(),
    ...overrides,
  };

  render(<VisualStyleInput {...(props as any)} />);
  return props;
}

export function invokeSetter(mock: ReturnType<typeof vi.fn>, previous: any) {
  const updater = mock.mock.calls.at(-1)?.[0];
  expect(typeof updater).toBe("function");
  return updater(previous);
}
