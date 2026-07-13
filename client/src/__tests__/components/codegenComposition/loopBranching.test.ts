import { describe, expect, it, normalize, useLoopCode } from "./testHarness";

describe("useLoopCode composition", () => {
  it("checks a newly requested loop branch target before suppressing remaining wrappers", () => {
    const genLoopCode = useLoopCode({
      id: "loop_chain",
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
          trialName: "Trial A",
          pluginName: "html-keyboard-response",
          timelineProps: "const Trial_A_timeline = { data: { trial_id: 1 } };",
          mappedJson: [{ stimulus_Trial_A: "A" }],
        },
        {
          trialName: "Trial C",
          pluginName: "html-keyboard-response",
          timelineProps: "const Trial_C_timeline = { data: { trial_id: 3 } };",
          mappedJson: [{ stimulus_Trial_C: "C" }],
        },
        {
          trialName: "Trial B",
          pluginName: "html-keyboard-response",
          timelineProps: "const Trial_B_timeline = { data: { trial_id: 2 } };",
          mappedJson: [{ stimulus_Trial_B: "B" }],
        },
      ],
      unifiedStimuli: [
        {
          stimulus_Trial_A: "A",
          stimulus_Trial_C: "C",
          stimulus_Trial_B: "B",
        },
      ],
    });

    const code = normalize(genLoopCode());
    const skipCheckIndex = code.indexOf("if (loop_loop_chain_SkipRemaining)");
    const targetExecutedIndex = code.indexOf(
      "if (loop_loop_chain_TargetExecuted)",
    );

    expect(skipCheckIndex).toBeGreaterThan(-1);
    expect(targetExecutedIndex).toBeGreaterThan(-1);
    expect(skipCheckIndex).toBeLessThan(targetExecutedIndex);
  });

  it("resets loop branch state after a shared terminal target so later wrappers continue", () => {
    const genLoopCode = useLoopCode({
      id: "loop_merge",
      branches: undefined,
      branchConditions: undefined,
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      mergePointIds: [3],
      trials: [
        {
          id: 1,
          trialName: "Trial A",
          pluginName: "html-keyboard-response",
          timelineProps: "const Trial_A_timeline = { data: { trial_id: 1 } };",
          mappedJson: [{ stimulus_Trial_A: "A" }],
        },
        {
          id: 3,
          trialName: "Shared Target",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Shared_Target_timeline = { data: { trial_id: 3 } };",
          mappedJson: [{ stimulus_Shared_Target: "C" }],
        },
        {
          id: 4,
          trialName: "After Merge",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const After_Merge_timeline = { data: { trial_id: 4 } };",
          mappedJson: [{ stimulus_After_Merge: "D" }],
        },
      ],
      unifiedStimuli: [
        {
          stimulus_Trial_A: "A",
          stimulus_Shared_Target: "C",
          stimulus_After_Merge: "D",
        },
      ],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const Shared_Target_wrapper =");
    expect(code).toContain("loop_loop_merge_NextTrialId = null;");
    expect(code).toContain("loop_loop_merge_SkipRemaining = false;");
    expect(code).toContain("loop_loop_merge_TargetExecuted = false;");
    expect(code).toContain("loop_loop_merge_ShouldBranchOnFinish = false;");
  });

  it("generates loop repeat conditions together with branch conditions", () => {
    const genLoopCode = useLoopCode({
      id: "loop_combo",
      branches: [10, "loop_next"],
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "go" }],
          nextTrialId: "loop_next",
        },
      ],
      repeatConditions: [
        {
          id: 1,
          rules: [
            {
              componentIdx: "Survey_1",
              prop: "answer",
              op: "!=",
              value: "stop",
            },
          ],
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
          trialName: "Combo Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Combo_Trial_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Combo_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Combo_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain(
      'const loopData = jsPsych.data.get().filter({loop_id: "loop_combo"}).values();',
    );
    expect(code).toContain("columnName = rule.componentIdx + '_' + rule.prop;");
    expect(code).toContain('const branches = [10,"loop_next"];');
    expect(code).toContain("const branchConditions =");
    expect(code).toContain("window.nextTrialId = branches[0];");
  });
});
