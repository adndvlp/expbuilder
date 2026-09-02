import {
  describe,
  expect,
  generateParamsOverrideCode,
  it,
  normalize,
} from "./testHarness";
import type { ParamsOverrideCondition } from "./testHarness";

describe("generateParamsOverrideCode", () => {
  it("returns an empty string when there are no override conditions", () => {
    expect(generateParamsOverrideCode()).toBe("");
    expect(generateParamsOverrideCode([])).toBe("");
  });

  it("generates previous-trial rule evaluation and nested override application", () => {
    const paramsOverride: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            column: "response",
            op: "==",
            value: "yes",
          },
        ],
        paramsToOverride: {
          stimulus: { source: "typed", value: "Changed" },
          choices: { source: "csv", value: "choice_col" },
          "components::Survey_1::survey_json::q1": {
            source: "typed",
            value: "default answer",
          },
          "components::Button_1::button_text": {
            source: "typed",
            value: "Continue",
          },
        },
      },
    ];
    const code = normalize(generateParamsOverrideCode(paramsOverride));

    expect(code).toContain("const paramsOverrideConditions =");
    expect(code).toContain("jsPsych.data.get().values()");
    expect(code).toContain(
      "window.ExpBuilderBranching.evaluateReferencedCondition",
    );
    expect(code).toContain(
      "Object.entries(matchedOverride.paramsToOverride)",
    );
    expect(code).toContain(
      "question.defaultValue = String(valueToSet)",
    );
    expect(code).toContain("component[propName] = valueToSet;");
    expect(code).toContain("trial[key] = valueToSet;");
    expect(code).toContain("'params-override'");
  });
});
