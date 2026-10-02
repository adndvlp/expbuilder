import { describe, expect, it, normalize, useLoopCode } from "./testHarness";

describe("useLoopCode composition", () => {
  it("preserves repeat conditions while ignoring obsolete loop branch fields", () => {
    const genLoopCode = useLoopCode({
      id: "loop_repeat_branch",
      branches: [10, "fallback_branch"],
      branchConditions: [],
      repeatConditions: [
        {
          id: 1,
          rules: [{ prop: "response", op: "==", value: "retry" }],
          jumpToTrialId: 10,
        },
      ],
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Repeat Branch Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Repeat_Branch_Trial_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Repeat_Branch_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Repeat_Branch_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const repeatConditions =");
    expect(code).toContain("window.ExpBuilderNavigation.requestJump(");
    expect(code).not.toContain('const branches = [10, "fallback_branch"];');
    expect(code).toContain("window.nextTrialId = pendingBranchTarget;");
  });

  it("does not generate conditional branching from obsolete loop fields", () => {
    const genLoopCode = useLoopCode({
      id: "loop_branch_only",
      branches: [10, "branch_b"],
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "go" }],
          nextTrialId: "branch_b",
        },
      ],
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Branch Only Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Branch_Only_Trial_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Branch_Only_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Branch_Only_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).not.toContain('const branches = [10, "branch_b"];');
    expect(code).not.toContain("window.ExpBuilderBranching.decide(");
    expect(code).toContain("window.nextTrialId = pendingBranchTarget;");
  });

  it("propagates concrete trial exits to the parent scope", () => {
    const genLoopCode = useLoopCode({
      id: "loop_child",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Nested Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Nested_Trial_timeline = { data: { trial_id: 30 } };",
          mappedJson: [{ stimulus_Nested_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Nested_Trial: "A" }],
      parentLoopId: "loop_parent",
    });

    const code = normalize(genLoopCode());

    expect(code).toContain(
      "loop_loop_parent_NextTrialId = pendingBranchTarget;",
    );
    expect(code).toContain("loop_loop_parent_SkipRemaining = true;");
    expect(code).toContain("loop_loop_parent_BranchingActive = true;");
    expect(code).not.toContain("window.nextTrialId = branches[0];");
  });
});
