import {
  describe,
  expect,
  generateRepeatConditionsCode,
  it,
  normalize,
} from "./testHarness";
import type { RepeatCondition } from "./testHarness";

describe("generateRepeatConditionsCode", () => {
  it("returns an empty string without repeat conditions", () => {
    expect(generateRepeatConditionsCode()).toBe("");
    expect(generateRepeatConditionsCode([])).toBe("");
  });

  it("generates repeat condition evaluation for arrays, dynamic columns and numeric operators", () => {
    const repeatConditions: RepeatCondition[] = [
      {
        id: 1,
        jumpToTrialId: 7,
        rules: [
          { column: "choices", op: "==", value: "A" },
          {
            column: "",
            componentIdx: "Survey_1",
            prop: "score",
            op: ">=",
            value: "3",
          },
          { column: "rt", op: "<", value: "1000" },
        ],
      },
    ];

    const code = normalize(generateRepeatConditionsCode(repeatConditions));

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain('"jumpToTrialId":7');
    expect(code).toContain("window.ExpBuilderBranching.evaluateCondition");
    expect(code).toContain("window.ExpBuilderNavigation.requestJump(");
    expect(code).toContain("sourceSessionId: trialSessionId");
    expect(code).not.toContain("jsPsych.run(timeline)");
    expect(code).not.toContain("document.getElementById");
  });
});
