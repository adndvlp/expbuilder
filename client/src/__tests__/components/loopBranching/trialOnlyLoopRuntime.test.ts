import { describe, expect, it, vi } from "vitest";
import useLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import { generateOnFinishCode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator";

const loopCode = () => useLoopCode({
  id: "outer",
  repetitions: 2,
  randomize: false,
  orders: false,
  stimuliOrders: [],
  categories: false,
  categoryData: [],
  unifiedStimuli: [{ row: 1 }, { row: 2 }],
  trials: [{
    isLoop: true,
    loopId: "inner",
    loopName: "Inner",
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    categories: false,
    categoryData: [],
    unifiedStimuli: [{}],
    items: [{
      id: "loop_trial",
      trialName: "Target",
      pluginName: "html-keyboard-response",
      timelineProps: "const Target_timeline = {};",
    }],
  }],
})();

describe("trial-only loop runtime", () => {
  it("generates only trial route state and no loop-owned branch decision or fallback", () => {
    const code = loopCode();
    expect(code).not.toMatch(/ShouldBranchOnFinish|HasBranches/);
    expect(code).not.toContain("ExpBuilderBranching.decide");
    expect(code).not.toContain("branches[0]");
    expect(code).not.toContain("abortExperiment");
    expect(code).toContain('remainingLoopRepetitions("outer", 2) ?? 2');
  });

  it.each(["outer", "inner", "loop_trial"])(
    "admits only real trial destinations through nested containers: %s",
    (target) => {
      const runtime = new Function("window", `
        const timeline = [];
        ${loopCode()}
        return {
          enter: () => outer_procedure.conditional_function(),
          start: () => outer_procedure.on_timeline_start(),
          child: () => Inner_wrapper.conditional_function(),
        };
      `)({ skipRemaining: true, nextTrialId: target });
      expect(runtime.enter()).toBe(target === "loop_trial");
      runtime.start();
      if (target === "loop_trial") expect(runtime.child()).toBe(true);
    },
  );

  it.each([false, true])(
    "a terminal trial preserves a reached route and uses no loop branch flags (repeat=%s)",
    (repeat) => {
      const code = generateOnFinishCode({
        isInLoop: true,
        getVarName: (name) => `loop_scope_${name}`,
        repeatConditions: repeat ? [{ id: 1, jumpToTrialId: 1, rules: [] }] : [],
      });
    expect(code).not.toMatch(/ShouldBranchOnFinish|HasBranches/);
      const abort = vi.fn();
      const create = new Function("window", "jsPsych", "reached", `
        let loop_scope_BranchingActive = reached;
        let loop_scope_TargetExecuted = reached;
        return { ${code} };
      `);
      const runtimeWindow = {
        branchingActive: true,
        ExpBuilderBranching: { evaluateCondition: () => false },
      };
      create(runtimeWindow, { abortExperiment: abort }, true).on_finish({});
      expect(abort).not.toHaveBeenCalled();
      create(runtimeWindow, { abortExperiment: abort }, false).on_finish({});
      expect(abort).toHaveBeenCalledOnce();
    },
  );
});
