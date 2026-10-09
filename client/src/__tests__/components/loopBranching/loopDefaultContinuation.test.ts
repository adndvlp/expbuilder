import vm from "node:vm";
import { describe, expect, it } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import { generateOnFinishCode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator";
import { getBranchEvaluatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/branchEvaluator";

function createRuntime(conditional = false) {
  const onFinish = generateOnFinishCode({
    branches: [2],
    branchConditions: conditional ? [{
      id: 10, rules: [{ column: "response", op: "==", value: "exit" }],
      nextTrialId: 2,
    }] : [],
    isInLoop: true,
    getVarName: name => `loop_rows_${name}`,
  });
  const code = generateLoopCode({
    id: "rows", repetitions: 2, randomize: false,
    orders: false, stimuliOrders: [], categories: false, categoryData: [],
    unifiedStimuli: [{ row: 1 }, { row: 2 }, { row: 3 }],
    trials: [{ id: 1, trialName: "Source", pluginName: "html-button-response",
      timelineProps: `const Source_timeline = { ${onFinish} };` }],
  })();
  const entry = generateOnFinishCode({ branches: [1], getVarName: name => name });
  return vm.runInNewContext(`
    const window = {};
    const timeline = [];
    ${getBranchEvaluatorRuntimeCode()}
    ${code}
    const entry = { ${entry} };
    entry.on_finish({ builder_id: 0 });
    rows_procedure.on_timeline_start();
    ({
      canRun: () => Source_wrapper.conditional_function(),
      finishRow: () => {
        Source_timeline.on_finish({ builder_id: 1, response: 'exit' });
        rows_iteration.on_timeline_finish();
      },
      finishLoop: () => rows_procedure.on_timeline_finish(),
      state: () => ({ target: window.nextTrialId, active: window.branchingActive }),
    });
  `);
}

describe("default continuation through CSV loops", () => {
  it("executes every row and repetition before following its last trial's default exit", () => {
    const runtime = createRuntime();
    for (let row = 0; row < 6; row++) {
      expect(runtime.canRun()).toBe(true);
      runtime.finishRow();
    }
    runtime.finishLoop();
    expect(runtime.state()).toEqual({ target: 2, active: true });
  });

  it("still leaves the loop immediately when its trial selects a conditional exit", () => {
    const runtime = createRuntime(true);
    expect(runtime.canRun()).toBe(true);
    runtime.finishRow();
    expect(runtime.canRun()).toBe(false);
    runtime.finishLoop();
    expect(runtime.state()).toEqual({ target: 2, active: true });
  });
});
