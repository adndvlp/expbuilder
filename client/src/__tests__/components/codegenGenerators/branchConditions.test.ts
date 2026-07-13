import {
  describe,
  expect,
  generateBranchConditionsCode,
  getVarName,
  it,
  normalize,
} from "./testHarness";
import type { BranchCondition } from "./testHarness";

describe("generateBranchConditionsCode", () => {
  it("generates automatic global branching when no conditions exist", () => {
    const code = normalize(
      generateBranchConditionsCode({
        branches: [2],
        getVarName,
      }),
    );

    expect(code).toContain("window.nextTrialId = 2;");
    expect(code).toContain("window.skipRemaining = true;");
    expect(code).toContain("window.branchingActive = true;");

    const stringCode = normalize(
      generateBranchConditionsCode({
        branches: ["trial_2"],
        getVarName,
      }),
    );
    expect(stringCode).toContain('window.nextTrialId = "trial_2";');
  });

  it("generates automatic loop-scoped branching variables", () => {
    const code = normalize(
      generateBranchConditionsCode({
        branches: ["loop_2", 3],
        isInLoop: true,
        getVarName,
      }),
    );

    expect(code).toContain('const branches = ["loop_2", 3];');
    expect(code).toContain("loop_1_NextTrialId = branches[0];");
    expect(code).toContain("loop_1_SkipRemaining = true;");
    expect(code).toContain("loop_1_BranchingActive = true;");
  });

  it("generates condition evaluation with dynamic/survey column fallback and custom params", () => {
    const branchConditions: BranchCondition[] = [
      {
        id: 1,
        nextTrialId: 3,
        rules: [
          {
            column: "SurveyComponent_1_choice",
            op: "==",
            value: "yes",
          },
        ],
        customParameters: {
          stimulus: { source: "typed", value: "Branch stimulus" },
        },
      },
    ];
    const code = normalize(
      generateBranchConditionsCode({
        branches: [3, "fallback"],
        branchConditions,
        getVarName,
      }),
    );

    expect(code).toContain("const branchConditions =");
    expect(code).toContain('"SurveyComponent_1_choice"');
    expect(code).toContain("const responseKey = componentName + '_response';");
    expect(code).toContain("responseData[propertyOrQuestion]");
    expect(code).toContain(
      "window.branchCustomParameters = matchedCustomParameters;",
    );

    const loopCode = normalize(
      generateBranchConditionsCode({
        branches: [3, "fallback"],
        branchConditions,
        isInLoop: true,
        getVarName,
      }),
    );
    expect(loopCode).toContain(
      "loop_1_BranchCustomParameters = matchedCustomParameters;",
    );
  });
});
