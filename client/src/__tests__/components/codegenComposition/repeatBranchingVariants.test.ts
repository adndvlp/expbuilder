import { describe, expect, it, normalize, useLoopCode } from "./testHarness";

describe("useLoopCode composition", () => {
  it("generates repeat conditions with automatic loop branching", () => {
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

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain('const branches = [10,"fallback_branch"];');
    expect(code).toContain("window.nextTrialId = branches[0];");
  });

  it("generates conditional loop branching without repeat conditions", () => {
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

    expect(code).toContain('const branches = [10,"branch_b"];');
    expect(code).toContain("const branchConditions =");
    expect(code).toContain("window.nextTrialId = branches[0];");
  });

  it("propagates nested loop branching to parent loop variables", () => {
    const genLoopCode = useLoopCode({
      id: "loop_child",
      branches: [99],
      branchConditions: undefined,
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

    expect(code).toContain("loop_loop_parent_NextTrialId = branches[0];");
    expect(code).toContain("loop_loop_parent_SkipRemaining = true;");
    expect(code).toContain("loop_loop_parent_BranchingActive = true;");
    expect(code).not.toContain("window.nextTrialId = branches[0];");
  });
});
