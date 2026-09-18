import vm from "node:vm";
import { describe, expect, it } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import { getBranchEvaluatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/branchEvaluator";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
  };
}

function buildLoopCode(options: {
  branches: Array<string | number>;
  branchConditions?: any[];
}) {
  return generateLoopCode({
    id: "csv-loop",
    branches: options.branches,
    branchConditions: options.branchConditions ?? [],
    repeatConditions: [],
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    categories: false,
    categoryData: [],
    trials: [
      {
        id: 1,
        trialName: "Source",
        pluginName: "html-keyboard-response",
        timelineProps: "const Source_timeline = {};",
      },
    ],
    unifiedStimuli: [
      { stimulus: "row-1" },
      { stimulus: "row-2" },
      { stimulus: "row-3" },
    ],
  })();
}

function runLoopOnFinish(loopCode: string) {
  const loops: any[] = [];
  const sandbox: Record<string, any> = {
    window: {},
    localStorage: memoryStore(),
    sessionStorage: memoryStore(),
    trialSessionId: "session-1",
    participantNumber: 1,
    jsPsych: {
      data: {
        get: () => ({
          filter: () => ({
            values: () => [
              { builder_id: 1, trial_index: 0, loop_id: "csv-loop" },
            ],
          }),
        }),
      },
    },
    timeline: { push: (item: any) => loops.push(item) },
    console,
    JSON,
    Math,
    Number,
    String,
    Array,
    Object,
    isNaN,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${getBranchEvaluatorRuntimeCode()}\n${loopCode}`, sandbox);
  const loopProcedure = loops.find(
    (item) => typeof item?.on_finish === "function",
  );
  if (!loopProcedure) {
    throw new Error("Generated loop procedure with on_finish not found");
  }
  loopProcedure.on_finish({ builder_id: 1, trial_index: 0 });
  return sandbox;
}

describe("loop branch decision vs CSV iteration", () => {
  it("keeps iterating the CSV when the loop has branches but no condition matches", () => {
    const sandbox = runLoopOnFinish(buildLoopCode({ branches: [999] }));

    expect(sandbox.window.skipRemaining).toBeUndefined();
    expect(sandbox.window.nextTrialId).toBeUndefined();
    expect(sandbox.window.branchingActive).toBeUndefined();
  });

  it("ignores legacy loop branch conditions entirely (branches belong to trials)", () => {
    const sandbox = runLoopOnFinish(
      buildLoopCode({
        branches: [999],
        branchConditions: [
          {
            id: "exit-condition",
            rules: [{ column: "loop_id", op: "==", value: "csv-loop" }],
            nextTrialId: 999,
            customParameters: { stimulus: { source: "typed", value: "x" } },
          },
        ],
      }),
    );

    expect(sandbox.window.skipRemaining).toBeUndefined();
    expect(sandbox.window.nextTrialId).toBeUndefined();
    expect(sandbox.window.branchingActive).toBeUndefined();
  });
});
