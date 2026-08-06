import { describe, expect, it, normalize, useLoopCode } from "./testHarness";

describe("useLoopCode loop exit branching", () => {
  it("evaluates loop branch conditions in on_timeline_finish for a root loop", () => {
    const genLoopCode = useLoopCode({
      id: "loop_exit",
      branches: [20, 30],
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "go", trialId: 11 }],
          nextTrialId: 30,
          customParameters: {
            stimulus: { source: "typed", value: "happy.png" },
          },
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
          trialName: "Exit Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Exit_Trial_timeline = { data: { trial_id: 11 } };",
          mappedJson: [{ stimulus_Exit_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Exit_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("on_timeline_finish: function()");
    expect(code).toContain("const exitBranches = [20,30];");
    expect(code).toContain("const exitBranchConditions =");
    expect(code).toContain('jsPsych.data.get().filter({loop_id: "loop_exit"})');
    expect(code).toContain(
      "String(loopDataRows[i].trial_id) === String(trialId)",
    );
    expect(code).toContain("exitTargetId = condition.nextTrialId;");
    expect(code).toContain("window.nextTrialId = exitTargetId;");
    expect(code).toContain("window.skipRemaining = true;");
    expect(code).toContain("window.branchingActive = true;");
    expect(code).toContain("window.branchCustomParameters = exitCustomParameters;");
    // Default when no condition matches
    expect(code).toContain("exitTargetId = exitBranches[0];");
    // Old placeholder behavior is gone
    expect(code).not.toContain("TODO: Implement condition evaluation");
    expect(code).not.toContain("window.nextTrialId = branches[0];");
  });

  it("falls back to the last loop trial row when a rule has no trialId", () => {
    const genLoopCode = useLoopCode({
      id: "loop_fallback",
      branches: [20, 30],
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "go" }],
          nextTrialId: 30,
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
          trialName: "Fallback Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Fallback_Trial_timeline = { data: { trial_id: 11 } };",
          mappedJson: [{ stimulus_Fallback_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Fallback_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const getRuleTrialData = (trialId) =>");
    expect(code).toContain("return loopDataRows[loopDataRows.length - 1];");
  });

  it("writes parent loop variables for a nested loop with branches", () => {
    const genLoopCode = useLoopCode({
      id: "loop_child",
      parentLoopId: "loop_parent",
      branches: [20, 30],
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "go", trialId: 11 }],
          nextTrialId: 30,
          customParameters: {
            stimulus: { source: "typed", value: "happy.png" },
          },
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
          trialName: "Nested Exit Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Nested_Exit_Trial_timeline = { data: { trial_id: 11 } };",
          mappedJson: [{ stimulus_Nested_Exit_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Nested_Exit_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("loop_loop_parent_NextTrialId = exitTargetId;");
    expect(code).toContain("loop_loop_parent_SkipRemaining = true;");
    expect(code).toContain("loop_loop_parent_BranchingActive = true;");
    expect(code).toContain(
      "loop_loop_parent_BranchCustomParameters = exitCustomParameters;",
    );
    expect(code).not.toContain("window.nextTrialId = exitTargetId;");
    // A nested loop with its own branches does not re-trigger the parent exit
    expect(code).not.toContain("loop_loop_parent_ShouldBranchOnFinish = true;");
  });

  it("keeps auto-branching to the first branch when no conditions are defined", () => {
    const genLoopCode = useLoopCode({
      id: "loop_plain",
      branches: [20, 30],
      branchConditions: undefined,
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Plain Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Plain_Trial_timeline = { data: { trial_id: 11 } };",
          mappedJson: [{ stimulus_Plain_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Plain_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const exitBranches = [20,30];");
    expect(code).toContain("exitTargetId = exitBranches[0];");
    expect(code).toContain("window.nextTrialId = exitTargetId;");
    // No data-access prelude is emitted when there is nothing to evaluate
    expect(code).not.toContain("const getRuleTrialData");
  });

  it("moves loop repeat/jump conditions into on_timeline_finish", () => {
    const genLoopCode = useLoopCode({
      id: "loop_jump",
      branches: [20, 30],
      branchConditions: undefined,
      repeatConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "retry", trialId: 11 }],
          jumpToTrialId: 99,
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
          trialName: "Jump Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Jump_Trial_timeline = { data: { trial_id: 11 } };",
          mappedJson: [{ stimulus_Jump_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Jump_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain(
      "localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));",
    );
    expect(code).toContain("jsPsych.run(timeline);");
    // The repeat block lives in the procedure's on_timeline_finish (the last
    // on_timeline_finish in the generated code), not in a dead on_finish
    const lastOnTimelineFinish = code.lastIndexOf("on_timeline_finish: function()");
    expect(lastOnTimelineFinish).toBeGreaterThan(-1);
    expect(code.indexOf("const repeatConditionsArray =")).toBeGreaterThan(
      lastOnTimelineFinish,
    );
    // The dead procedure-level on_finish branching code is gone
    expect(code).not.toContain("Loop on_finish: branching to");
    expect(code).not.toContain("This loop has no branches, it is a terminal loop");
  });

  it("propagates ShouldBranchOnFinish to the parent when a nested loop without branches ends", () => {
    const genLoopCode = useLoopCode({
      id: "loop_child_terminal",
      parentLoopId: "loop_parent",
      branches: undefined,
      branchConditions: undefined,
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Terminal Nested Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Terminal_Nested_Trial_timeline = { data: { trial_id: 11 } };",
          mappedJson: [{ stimulus_Terminal_Nested_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Terminal_Nested_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("if (loop_loop_parent_HasBranches) {");
    expect(code).toContain("loop_loop_parent_ShouldBranchOnFinish = true;");
    // Without branches there is no exit block for this loop
    expect(code).not.toContain("const exitBranches");
  });
});
