import { describe, expect, it } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import type { LoopData } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/types";
import { resumeCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";

const generateNestedLoop = () => {
  const innerLoop: LoopData = {
    loopId: "inner",
    loopName: "Inner",
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    categories: false,
    categoryData: [],
    branches: [],
    branchConditions: [],
    repeatConditions: [],
    items: [
      {
        id: 42,
        trialName: "Target",
        pluginName: "html-keyboard-response",
        timelineProps: "const Target_timeline = {};",
      },
    ],
    unifiedStimuli: [],
    isLoop: true,
  };

  return generateLoopCode({
    id: "outer",
    parentLoopId: null,
    branches: [],
    branchConditions: [],
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    categories: false,
    categoryData: [],
    trials: [innerLoop],
    unifiedStimuli: [],
  })();
};

type GeneratedRuntime = {
  finishInner: () => void;
  finishInnerWrapper: () => void;
  finishOuter: () => void;
  finishTargetWrapper: () => void;
  innerCanRun: () => boolean;
  innerWrapperCanRun: () => boolean;
  outerCanRun: () => boolean;
  routeTo: (target: number, parameters: Record<string, string>) => void;
  routeResult: () => Record<string, unknown>;
  setJump: (target: number) => void;
  startInner: () => void;
  startOuter: () => void;
  targetCanRun: () => boolean;
};

const createRuntime = (code: string) =>
  new Function(`
    const timeline = [];
    const storage = new Map();
    const localStorage = {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, String(value)),
    };
    const window = {
      nextTrialId: null,
      skipRemaining: false,
      branchingActive: false,
      branchCustomParameters: null,
    };
    ${code}
    return {
      finishInner: () => inner_procedure.on_timeline_finish(),
      finishInnerWrapper: () => Inner_wrapper.on_timeline_finish(),
      finishOuter: () => outer_procedure.on_timeline_finish(),
      finishTargetWrapper: () => Target_wrapper.on_timeline_finish(),
      innerCanRun: () => inner_procedure.conditional_function(),
      innerWrapperCanRun: () => Inner_wrapper.conditional_function(),
      outerCanRun: () => outer_procedure.conditional_function(),
      routeTo: (target, parameters) => {
        window.nextTrialId = target;
        window.skipRemaining = true;
        window.branchingActive = true;
        window.branchCustomParameters = parameters;
      },
      routeResult: () => ({
        target: window.nextTrialId,
        skip: window.skipRemaining,
        active: window.branchingActive,
        parameters: window.branchCustomParameters,
      }),
      setJump: (target) => localStorage.setItem('jsPsych_jumpToTrial', target),
      startInner: () => inner_procedure.on_timeline_start(),
      startOuter: () => outer_procedure.on_timeline_start(),
      targetCanRun: () => Target_wrapper.conditional_function(),
    };
  `)() as GeneratedRuntime;

describe("nested loop route generation", () => {
  it("publishes every descendant ID for routing through collapsed scopes", () => {
    const code = generateNestedLoop();

    expect(code).toContain("const loop_inner_DescendantIds = [42];");
    expect(code).toContain(
      'const loop_outer_DescendantIds = ["inner", ...loop_inner_DescendantIds];',
    );
  });

  it("executes an exact branch target inside a nested loop", () => {
    const runtime = createRuntime(generateNestedLoop());

    runtime.routeTo(42, { answer: "nested" });
    expect(runtime.outerCanRun()).toBe(true);
    runtime.startOuter();
    expect(runtime.innerWrapperCanRun()).toBe(true);
    expect(runtime.innerCanRun()).toBe(true);
    runtime.startInner();
    expect(runtime.targetCanRun()).toBe(true);
    runtime.finishTargetWrapper();
    runtime.finishInner();
    runtime.finishInnerWrapper();
    runtime.finishOuter();

    expect(runtime.routeResult()).toEqual({
      target: null,
      skip: false,
      active: false,
      parameters: null,
    });
  });

  it("lets jump-to-trial enter every loop ancestor before consuming the target", () => {
    const runtime = createRuntime(generateNestedLoop());

    runtime.setJump(42);
    expect(runtime.outerCanRun()).toBe(true);
    runtime.startOuter();
    expect(runtime.innerWrapperCanRun()).toBe(true);
    expect(runtime.innerCanRun()).toBe(true);
    runtime.startInner();
    expect(runtime.targetCanRun()).toBe(true);
  });

  it("routes a resumed branch through every nested-loop ancestor", () => {
    const resolveResumeBranch = new Function(
      `${resumeCode()}; return _resolveResumeBranch;`,
    )() as (raw: string) => string | null;
    const target = resolveResumeBranch(
      JSON.stringify({ branches: [42], branchConditions: [], trialData: {} }),
    );
    const runtime = createRuntime(generateNestedLoop());

    expect(target).toBe("42");
    runtime.setJump(Number(target));
    expect(runtime.outerCanRun()).toBe(true);
    runtime.startOuter();
    expect(runtime.innerWrapperCanRun()).toBe(true);
    expect(runtime.innerCanRun()).toBe(true);
    runtime.startInner();
    expect(runtime.targetCanRun()).toBe(true);
  });
});
