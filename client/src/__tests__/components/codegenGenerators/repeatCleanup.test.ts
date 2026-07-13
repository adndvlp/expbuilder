import {
  describe,
  expect,
  generateOnFinishCode,
  getVarName,
  it,
  normalize,
} from "./testHarness";
import type { RepeatCondition } from "./testHarness";

describe("generateOnFinishCode merge points", () => {
  const repeatConditions: RepeatCondition[] = [
    {
      id: 1,
      jumpToTrialId: 7,
      rules: [{ column: "score", op: ">=", value: "3" }],
    },
  ];

  it("combines repeat-only loop code with loop branch cleanup", () => {
    const loopCode = normalize(
      generateOnFinishCode({
        branches: [],
        repeatConditions,
        isInLoop: true,
        getVarName,
      }),
    );
    const mergeLoopCode = normalize(
      generateOnFinishCode({
        branches: [],
        repeatConditions,
        isInLoop: true,
        isMergePoint: true,
        getVarName,
      }),
    );

    expect(loopCode).toContain("const repeatConditionsArray =");
    expect(loopCode).toContain("loop_1_ShouldBranchOnFinish = true;");
    expect(mergeLoopCode).toContain("loop_1_NextTrialId = null;");
    expect(mergeLoopCode).toContain("loop_1_ShouldBranchOnFinish = false;");
  });

  it("combines repeat-only global merge code with custom code", () => {
    const code = normalize(
      generateOnFinishCode({
        branches: [],
        repeatConditions,
        isMergePoint: true,
        getVarName,
        customOnFinish: "data.afterRepeat = true;",
      }),
    );

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain("data.afterRepeat = true;");
    expect(code).toContain("window.nextTrialId = null;");
    expect(code).toContain("window.branchCustomParameters = null;");
  });
});
