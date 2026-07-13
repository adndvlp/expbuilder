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
    expect(code).toContain("Array.isArray(propValue)");
    expect(code).toContain("return propValue.includes(compareValue);");
    expect(code).toContain("columnName = rule.componentIdx + '_' + rule.prop;");
    expect(code).toContain("case '>=':");
    expect(code).toContain(
      "localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));",
    );
    expect(code).toContain("jsPsych.run(timeline);");
  });
});
