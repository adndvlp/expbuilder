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
  branchConditions?: unknown[];
}) {
  return generateLoopCode({
    // Deliberately inject invalid legacy fields to verify they cannot route.
    ...options,
    id: "csv-loop",
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

function runLoopOnTimelineFinish(loopCode: string) {
  type LoopProcedure = {
    timeline_variables: Record<string, unknown>[];
    on_timeline_finish: () => void;
  };
  const loops: LoopProcedure[] = [];
  const windowState: {
    skipRemaining?: boolean;
    nextTrialId?: string | number | null;
    branchingActive?: boolean;
  } = {};
  const sandbox = {
    window: windowState,
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
    timeline: { push: (item: LoopProcedure) => loops.push(item) },
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
    (item) => typeof item?.on_timeline_finish === "function",
  );
  if (!loopProcedure) {
    throw new Error(
      "Generated loop procedure with on_timeline_finish not found",
    );
  }
  expect(loopProcedure.timeline_variables).toEqual([
    { stimulus: "row-1" },
    { stimulus: "row-2" },
    { stimulus: "row-3" },
  ]);
  loopProcedure.on_timeline_finish();
  return sandbox;
}

describe("legacy loop fields cannot decide CSV routing", () => {
  it("ignores legacy loop branch targets when its CSV procedure finishes", () => {
    const sandbox = runLoopOnTimelineFinish(buildLoopCode({ branches: [999] }));

    expect(sandbox.window.skipRemaining).toBeUndefined();
    expect(sandbox.window.nextTrialId).toBeUndefined();
    expect(sandbox.window.branchingActive).toBeUndefined();
  });

  it("ignores legacy loop branch conditions entirely (branches belong to trials)", () => {
    const sandbox = runLoopOnTimelineFinish(
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
