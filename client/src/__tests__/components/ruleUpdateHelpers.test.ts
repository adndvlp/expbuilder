import { describe, expect, it } from "vitest";
import {
  updateComponentIdx as updateBranchComponentIdx,
  updateFieldType as updateBranchFieldType,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/ruleUpdateHelpers";
import {
  updateComponentIdx as updateParamsComponentIdx,
  updateFieldType as updateParamsFieldType,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ruleUpdateHelpers";
import {
  updateComponentIdx as updateLoopComponentIdx,
  updateFieldType as updateLoopFieldType,
  updateProp as updateLoopProp,
  updateTrialSelection,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/ruleUpdateHelpers";

function conditions() {
  return [
    {
      id: 1,
      rules: [
        {
          trialId: "trial-a",
          fieldType: "components",
          componentIdx: "old",
          prop: "response",
          column: "response",
          op: "==",
          value: "yes",
        },
        {
          trialId: "trial-b",
          fieldType: "components",
          componentIdx: "keep-rule",
          prop: "rt",
          column: "rt",
          op: ">",
          value: "10",
        },
      ],
      customParameters: {},
    },
    {
      id: 2,
      rules: [
        {
          trialId: "foreign",
          fieldType: "components",
          componentIdx: "keep-condition",
          prop: "response",
          column: "response",
          op: "==",
          value: "untouched",
        },
      ],
      customParameters: {},
    },
  ] as any[];
}

function expectOnlyTargetChanged(result: any[], original: any[]) {
  expect(result[0]).not.toBe(original[0]);
  expect(result[0].rules[1]).toBe(original[0].rules[1]);
  expect(result[1]).toBe(original[1]);
}

describe("rule update helpers", () => {
  it("preserves unrelated branched-trial and params-override rules", () => {
    const branchConditions = conditions();
    expectOnlyTargetChanged(
      updateBranchFieldType(branchConditions as any, 1, 0, "response_components"),
      branchConditions,
    );
    expectOnlyTargetChanged(
      updateBranchComponentIdx(branchConditions as any, 1, 0, "button"),
      branchConditions,
    );

    const paramsConditions = conditions();
    expectOnlyTargetChanged(
      updateParamsFieldType(paramsConditions as any, 1, 0, "response_components"),
      paramsConditions,
    );
    expectOnlyTargetChanged(
      updateParamsComponentIdx(paramsConditions as any, 1, 0, "button"),
      paramsConditions,
    );
  });

  it("preserves unrelated conditional-loop rules for every update", () => {
    const helpers = [
      (value: any[]) => updateTrialSelection(value as any, 1, 0, "trial-next"),
      (value: any[]) => updateLoopFieldType(value as any, 1, 0, "response_components"),
      (value: any[]) => updateLoopComponentIdx(value as any, 1, 0, "button"),
      (value: any[]) => updateLoopProp(value as any, 1, 0, "choice"),
    ];

    helpers.forEach((update) => {
      const original = conditions();
      expectOnlyTargetChanged(update(original), original);
    });
  });
});
