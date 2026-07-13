import {
  describe,
  expect,
  generateOnFinishCode,
  getVarName,
  it,
  normalize,
} from "./testHarness";

describe("generateOnFinishCode merge points", () => {
  it("clears global branch state for terminal top-level merge targets", () => {
    const code = normalize(
      generateOnFinishCode({
        branches: [],
        branchConditions: [],
        isMergePoint: true,
        getVarName,
      }),
    );

    expect(code).toContain("window.nextTrialId = null;");
    expect(code).toContain("window.skipRemaining = false;");
    expect(code).toContain("window.branchingActive = false;");
    expect(code).not.toContain("jsPsych.abortExperiment");
  });

  it("clears loop branch state for terminal loop-scoped merge targets", () => {
    const code = normalize(
      generateOnFinishCode({
        branches: [],
        branchConditions: [],
        isInLoop: true,
        isMergePoint: true,
        getVarName,
      }),
    );

    expect(code).toContain("loop_1_NextTrialId = null;");
    expect(code).toContain("loop_1_SkipRemaining = false;");
    expect(code).toContain("loop_1_TargetExecuted = false;");
    expect(code).toContain("loop_1_BranchingActive = false;");
    expect(code).not.toContain("jsPsych.abortExperiment");
  });

  it("aborts active branching for plain non-merge terminal trials", () => {
    const topLevelCode = normalize(
      generateOnFinishCode({
        branches: [],
        getVarName,
        customOnFinish: "data.saved = true;",
      }),
    );
    const loopCode = normalize(
      generateOnFinishCode({
        branches: [],
        isInLoop: true,
        getVarName,
      }),
    );

    expect(topLevelCode).toContain("data.saved = true;");
    expect(topLevelCode).toContain("if (window.branchingActive)");
    expect(topLevelCode).toContain("jsPsych.abortExperiment('', {});");
    expect(loopCode).toContain("loop_1_ShouldBranchOnFinish = true;");
    expect(loopCode).toContain("else if (!loop_1_HasBranches)");
  });

  it("appends branch condition code in the final on_finish path", () => {
    const code = normalize(
      generateOnFinishCode({
        branches: [2],
        branchConditions: [],
        getVarName,
      }),
    );

    expect(code).toContain("window.nextTrialId = 2;");
    expect(code).toContain("window.branchingActive = true;");
  });
});
