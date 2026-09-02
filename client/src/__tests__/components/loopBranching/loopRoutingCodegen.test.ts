import { describe, expect, it } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import type { LoopData } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/types";
import { getJumpRequestRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/jumpRequest";
import { getNavigationCoordinatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/navigationCoordinator";
import { getPersistenceCoordinatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/persistenceCoordinator";

const generateNestedLoop = (targetName = "Target") => {
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
        trialName: targetName,
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
  getJump: () => Record<string, unknown> | null;
  innerCanRun: () => boolean;
  innerWrapperCanRun: () => boolean;
  outerCanRun: () => boolean;
  routeTo: (target: number, parameters: Record<string, string>) => void;
  routeResult: () => Record<string, unknown>;
  resumeTo: (target: number) => void;
  setJump: (target: number) => void;
  startInner: () => void;
  startOuter: () => void;
  targetCanRun: () => boolean;
  targetEntryCanRun: () => boolean;
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
    const sessionValues = new Map();
    const sessionStorage = {
      getItem: (key) => sessionValues.has(key) ? sessionValues.get(key) : null,
      removeItem: (key) => sessionValues.delete(key),
      setItem: (key, value) => sessionValues.set(key, String(value)),
    };
    const window = {
      location: { reload: () => undefined },
      nextTrialId: null,
      skipRemaining: false,
      branchingActive: false,
      branchCustomParameters: null,
      ExpBuilderRuntime: {
        emit: () => undefined,
        reportError: () => undefined,
      },
      ExpBuilderExecutionAddresses: {
        version: 2,
        revision: 'r1',
        nextBySource: {},
        addressesByTarget: {
          '42': {
            targetId: '42',
            targetKind: 'trial',
            targetOwnerId: 'inner',
            enterLoopIds: ['outer', 'inner'],
          },
        },
      },
    };
    ${getPersistenceCoordinatorRuntimeCode()}
    ${getJumpRequestRuntimeCode()}
    ${getNavigationCoordinatorRuntimeCode()}
    ${code}
    return {
      finishInner: () => inner_procedure.on_timeline_finish(),
      finishInnerWrapper: () => Inner_wrapper.on_timeline_finish(),
      finishOuter: () => outer_procedure.on_timeline_finish(),
      finishTargetWrapper: () => Target_wrapper.on_timeline_finish(),
      getJump: () => {
        const raw = localStorage.getItem('jsPsych_jumpRequest');
        return raw ? JSON.parse(raw) : null;
      },
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
      resumeTo: (target) => window.ExpBuilderNavigation.activateResume({
        kind: 'sequential',
        sourceId: 'source',
        targetId: String(target),
        conditionId: null,
      }),
      setJump: (target) => window.ExpBuilderNavigation.requestJump(
        target,
        { sourceId: 'source' },
        { builder_id: 'source', trial_index: 1 },
      ),
      startInner: () => inner_procedure.on_timeline_start(),
      startOuter: () => outer_procedure.on_timeline_start(),
      targetCanRun: () => Target_wrapper.conditional_function(),
      targetEntryCanRun: () =>
        window.ExpBuilderNavigation.enterItem(42, 'trial'),
    };
  `)() as GeneratedRuntime;

describe("nested loop route generation", () => {
  it("[TG-07] preserves domain IDs while sanitizing generated names", () => {
    const code = generateNestedLoop("Target / punctuation");

    expect(code).toContain("const loop_inner_DescendantIds = [42];");
    expect(code).toContain(
      'const loop_outer_DescendantIds = ["inner", ...loop_inner_DescendantIds];',
    );
    expect(code).toContain("const currentId = 42;");
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

  it("[TJ-06] keeps a nested jump separate from exit-branch state", () => {
    const runtime = createRuntime(generateNestedLoop());

    runtime.setJump(42);
    expect(runtime.outerCanRun()).toBe(true);
    expect(runtime.getJump()).toMatchObject({
      cursor: { nextEnterIndex: 1, progress: 1 },
    });
    runtime.startOuter();
    expect(runtime.innerWrapperCanRun()).toBe(true);
    expect(runtime.innerCanRun()).toBe(true);
    expect(runtime.getJump()).toMatchObject({
      cursor: { nextEnterIndex: 2, progress: 2 },
    });
    runtime.startInner();
    expect(runtime.targetCanRun()).toBe(true);
    expect(runtime.getJump()).not.toBeNull();
    expect(runtime.targetEntryCanRun()).toBe(true);
    expect(runtime.getJump()).toBeNull();
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

  it("routes a sequential resume through every nested-loop ancestor", () => {
    const runtime = createRuntime(generateNestedLoop());

    runtime.resumeTo(42);
    expect(runtime.outerCanRun()).toBe(true);
    runtime.startOuter();
    expect(runtime.innerWrapperCanRun()).toBe(true);
    expect(runtime.innerCanRun()).toBe(true);
    runtime.startInner();
    expect(runtime.targetCanRun()).toBe(true);
    expect(runtime.targetEntryCanRun()).toBe(true);
    expect(runtime.getJump()).toBeNull();
  });
});
