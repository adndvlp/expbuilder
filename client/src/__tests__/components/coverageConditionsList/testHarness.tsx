import { render } from "@testing-library/react";
import { vi } from "vitest";
import ConditionsList from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList";
import TableBody from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/TableBody";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ConditionRule",
  () => ({
    default: ({
      condition,
      ruleIndex,
      updateRule,
      removeRuleFromCondition,
      getAvailableColumns,
      selectedTrial,
      triggerSave,
    }: any) => (
      <td data-testid={`rule-${condition.id}-${ruleIndex}`}>
        <span>
          rule {condition.id}:{ruleIndex}:{selectedTrial?.plugin}
        </span>
        <span> columns {getAvailableColumns().length}</span>
        <button
          type="button"
          onClick={() =>
            updateRule(condition.id, ruleIndex, "value", "ok", true)
          }
        >
          update rule {condition.id}-{ruleIndex}
        </button>
        <button
          type="button"
          onClick={() => removeRuleFromCondition(condition.id, ruleIndex)}
        >
          remove rule {condition.id}-{ruleIndex}
        </button>
        <button type="button" onClick={triggerSave}>
          save rule {condition.id}-{ruleIndex}
        </button>
      </td>
    ),
  }),
);

export function TableBodyHarness(props: Record<string, unknown>) {
  return <TableBody {...(props as any)} />;
}

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride",
  () => ({
    ParameterOverride: ({
      condition,
      paramKey,
      isTargetDynamic,
      isJumpCondition,
      hasSurveyJsonParam,
      setConditions,
      conditions,
      triggerSave,
    }: any) => (
      <td
        data-testid={`override-${condition.id}-${paramKey || "empty"}`}
        data-dynamic={String(isTargetDynamic)}
        data-jump={String(isJumpCondition)}
        data-survey={String(hasSurveyJsonParam)}
      >
        <button
          type="button"
          onClick={() => {
            setConditions(conditions, true);
            triggerSave();
          }}
        >
          override {condition.id}:{paramKey || "empty"}
        </button>
      </td>
    ),
    AddParamButtonCell: ({
      condition,
      addCustomParameter,
      isTargetDynamic,
      hasSurveyJsonParam,
    }: any) => (
      <td
        data-testid={`add-param-${condition.id}`}
        data-dynamic={String(isTargetDynamic)}
        data-survey={String(hasSurveyJsonParam)}
      >
        <button
          type="button"
          onClick={() => addCustomParameter(condition.id, isTargetDynamic)}
        >
          add param {condition.id}
        </button>
      </td>
    ),
  }),
);

export const dynamicTarget = {
  id: "dynamic-target",
  plugin: "plugin-dynamic",
  columnMapping: {
    components: {
      value: [
        {
          name: { source: "typed", value: "survey" },
          type: "SurveyComponent",
        },
      ],
    },
  },
};

export const normalTarget = {
  id: "jump-target",
  plugin: "plugin-html-keyboard-response",
};

export function renderConditionsList() {
  const conditions = [
    {
      id: 1,
      nextTrialId: "dynamic-target",
      rules: [{ trialId: "source", prop: "response", op: "==", value: "yes" }],
      customParameters: {
        "components::survey::survey_json": {
          source: "typed",
          value: { elements: [{ name: "q1" }] },
        },
      },
    },
    {
      id: 2,
      nextTrialId: "jump-target",
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "500" }],
      customParameters: {},
    },
  ] as any[];

  const props = {
    conditions,
    removeCondition: vi.fn(),
    findTrialById: vi.fn((trialId: string | number) => {
      if (trialId === "dynamic-target") return dynamicTarget;
      if (trialId === "jump-target") return normalTarget;
      return null;
    }),
    targetTrialParameters: {
      "dynamic-target": [
        { key: "survey_json", label: "Survey JSON", type: "object" },
        { key: "text", label: "Text", type: "string" },
      ],
      "jump-target": [{ key: "stimulus", label: "Stimulus", type: "string" }],
    },
    isJumpCondition: vi.fn((condition: any) => condition.id === 2),
    triggerSave: vi.fn(),
    addCustomParameter: vi.fn(),
    addRuleToCondition: vi.fn(),
    removeRuleFromCondition: vi.fn(),
    selectedTrial: { id: "selected", plugin: "plugin-dynamic" },
    updateRule: vi.fn(),
    getAvailableColumns: vi.fn(() => [
      { value: "response", label: "Response" },
      { value: "rt", label: "RT", group: "Timing" },
    ]),
    setConditionsWrapper: vi.fn(),
    updateNextTrial: vi.fn(),
    isInBranches: vi.fn(() => false),
    branchTrials: [{ id: "branch-a", name: "Branch A", isLoop: false }],
    allJumpTrials: [
      {
        id: "jump-target",
        name: "Jump Target",
        displayName: "Jump Target",
        isLoop: true,
      },
    ],
    targetTrialCsvColumns: {
      "dynamic-target": ["score", "answer"],
      "jump-target": ["stimulus"],
    },
  };

  const view = render(<ConditionsList {...(props as any)} />);
  return { ...view, props };
}
