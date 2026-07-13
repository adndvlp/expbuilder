import { describe, expect, it, normalize, useLoopCode } from "./testHarness";

describe("useLoopCode composition", () => {
  it("recursively generates nested loop items without precomputed timeline props", () => {
    const genLoopCode = useLoopCode({
      id: "parent_loop",
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
          isLoop: true,
          loopId: "precomputed_loop",
          loopName: "Precomputed Loop",
          timelineProps: "const precomputed_loop_procedure = { timeline: [] };",
          items: [],
        } as any,
        {
          isLoop: true,
          loopId: "nested_loop",
          loopName: "Nested Loop",
          items: [
            {
              id: 2,
              trialName: "Nested Trial",
              pluginName: "html-keyboard-response",
              timelineProps:
                "const Nested_Trial_timeline = { data: { trial_id: 2 } };",
              mappedJson: [{ stimulus_Nested_Trial: "Nested" }],
            },
          ],
        } as any,
      ],
      unifiedStimuli: [],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const nested_loop_procedure =");
    expect(code).toContain(
      "const precomputed_loop_procedure = { timeline: [] };",
    );
    expect(code).toContain("const parent_loop_procedure =");
    expect(code).toContain(
      "timeline: [Precomputed_Loop_wrapper, Nested_Loop_wrapper]",
    );
  });

  it("uses main and Loop fallbacks when the loop id is absent", () => {
    const genLoopCode = useLoopCode({
      id: undefined,
      branches: [],
      branchConditions: [],
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [],
      unifiedStimuli: [],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("Branching logic variables for loop main");
    expect(code).toContain("let loop_Loop_NextTrialId = null;");
  });
});
