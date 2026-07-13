import { describe, expect, it, normalize, useLoopCode } from "./testHarness";

describe("useLoopCode composition", () => {
  it("generates a loop procedure with trial wrappers and unified stimuli", () => {
    const genLoopCode = useLoopCode({
      id: "loop_1",
      branches: undefined,
      branchConditions: undefined,
      repetitions: 2,
      randomize: true,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Loop Trial A",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Loop_Trial_A_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Loop_Trial_A: "A" }],
        },
        {
          trialName: "Loop Trial B",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Loop_Trial_B_timeline = { data: { trial_id: 11 } };",
          mappedJson: [{ stimulus_Loop_Trial_B: "B" }],
        },
      ],
      unifiedStimuli: [
        { stimulus_Loop_Trial_A: "A", stimulus_Loop_Trial_B: "B" },
      ],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const test_stimuli_loop_1 = [");
    expect(code).toContain("const Loop_Trial_A_wrapper =");
    expect(code).toContain("const Loop_Trial_B_wrapper =");
    expect(code).toContain("let loop_loop_1_NextTrialId = null;");
    expect(code).toContain("const loop_1_procedure =");
    expect(code).toContain(
      "timeline: [Loop_Trial_A_wrapper, Loop_Trial_B_wrapper]",
    );
    expect(code).toContain("repetitions: 2");
    expect(code).toContain("randomize_order: true");
    expect(code).toContain('data: { loop_id: "loop_1" }');
    expect(code).toContain("timeline.push(loop_1_procedure)");
  });

  it("generates conditional loop_function rules and orders/categories filtering", () => {
    const genLoopCode = useLoopCode({
      id: "loop_2",
      branches: ["loop_3"],
      branchConditions: [],
      repetitions: 1,
      randomize: false,
      orders: true,
      stimuliOrders: [[1, 0]],
      categories: true,
      categoryData: ["practice", "main"],
      trials: [
        {
          trialName: "Conditional Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Conditional_Trial_timeline = { data: { trial_id: 20 } };",
          mappedJson: [{ stimulus_Conditional_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Conditional_Trial: "A" }],
      isConditionalLoop: true,
      loopConditions: [
        {
          id: 1,
          rules: [{ trialId: 20, prop: "response", op: "==", value: "again" }],
        },
      ],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("let test_stimuli_loop_2 = [];");
    expect(code).toContain("const stimuliOrders = [[1,0]];");
    expect(code).toContain('const categoryData = ["practice","main"];');
    expect(code).toContain("loop_function: function(data)");
    expect(code).toContain("const loopConditionsArray =");
    expect(code).toContain("const shouldRepeat = loopConditionsArray.some");
    expect(code).toContain("window.nextTrialId = null;");
    expect(code).toContain("window.skipRemaining = false;");
    expect(code).toContain("window.nextTrialId = branches[0];");
  });

  it("generates loop repeat/jump conditions in on_finish", () => {
    const genLoopCode = useLoopCode({
      id: "loop_repeat",
      branches: undefined,
      branchConditions: undefined,
      repeatConditions: [
        {
          id: 1,
          rules: [{ prop: "response", op: "==", value: "again" }],
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
          trialName: "Repeat Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Repeat_Trial_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Repeat_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Repeat_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain(
      "localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));",
    );
    expect(code).toContain("jsPsych.run(timeline);");
  });
});
