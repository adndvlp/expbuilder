import { describe, expect, it } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import { generateOnFinishCode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator";

const generateLoop = (parentLoopId: string | null) =>
  generateLoopCode({
    id: "inner",
    parentLoopId,
    branches: [],
    branchConditions: [],
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
      {
        id: 2,
        trialName: "Later Trial",
        pluginName: "html-keyboard-response",
        timelineProps: "const Later$20$Trial_timeline = {};",
      },
    ],
    unifiedStimuli: [],
  })();

describe("loop exit code generation", () => {
  it("propagates the exact unresolved target and custom parameters to its parent", () => {
    const code = generateLoop("parent");

    expect(code).toContain(
      "const pendingBranchTarget = loop_inner_NextTrialId;",
    );
    expect(code).toContain(
      "const pendingBranchCustomParameters = loop_inner_BranchCustomParameters;",
    );
    expect(code).toContain(
      "loop_parent_NextTrialId = pendingBranchTarget;",
    );
    expect(code).toContain(
      "loop_parent_BranchCustomParameters = pendingBranchCustomParameters;",
    );
    expect(code).toContain("if (hasUnresolvedExit)");
  });

  it("propagates the exact unresolved target to the root timeline", () => {
    const code = generateLoop(null);

    expect(code).toContain("window.nextTrialId = pendingBranchTarget;");
    expect(code).toContain(
      "window.branchCustomParameters = pendingBranchCustomParameters;",
    );
  });

  it("does not erase an unresolved exit in the last wrapper", () => {
    const code = generateLoop("parent");
    const wrapperStart = code.indexOf("const Later$20$Trial_wrapper =");
    const loopStart = code.indexOf("const inner_procedure =");
    const wrapperCode = code.slice(wrapperStart, loopStart);

    expect(wrapperCode).toContain(
      "const hasUnresolvedExit = loop_inner_BranchingActive &&",
    );
    expect(wrapperCode).toContain(
      "if (!hasUnresolvedExit && !hasResolvedExit)",
    );
  });

  it("does not reinterpret a reached target as another loop branch", () => {
    const code = generateOnFinishCode({
      isInLoop: true,
      getVarName: (name) => `loop_scope_${name}`,
    });

    expect(code).toContain(
      "loop_scope_BranchingActive && loop_scope_TargetExecuted",
    );
    expect(code).toContain("loop_scope_ShouldBranchOnFinish = false;");
  });

  it("does not abort a root exit while its exact target is being propagated", () => {
    const code = generateLoop(null);

    expect(code).toContain(
      "if (window.branchingActive && !loop_inner_BranchingActive)",
    );
  });

  it("transfers an exit from a non-terminal source without losing its payload", () => {
    const code = generateLoop("parent");
    const factory = new Function(`
      const timeline = [];
      let loop_parent_NextTrialId = null;
      let loop_parent_SkipRemaining = false;
      let loop_parent_BranchingActive = false;
      let loop_parent_BranchCustomParameters = null;
      ${code}
      return {
        finishSource: () => Source_wrapper.on_timeline_finish(),
        finishLoop: () => inner_procedure.on_timeline_finish(),
        route: (target, parameters) => {
          loop_inner_NextTrialId = target;
          loop_inner_SkipRemaining = true;
          loop_inner_BranchingActive = true;
          loop_inner_BranchCustomParameters = parameters;
        },
        result: () => ({
          target: loop_parent_NextTrialId,
          parameters: loop_parent_BranchCustomParameters,
          active: loop_parent_BranchingActive,
        }),
      };
    `)() as {
      finishSource: () => void;
      finishLoop: () => void;
      route: (target: number, parameters: Record<string, string>) => void;
      result: () => {
        target: number;
        parameters: Record<string, string>;
        active: boolean;
      };
    };

    factory.route(777, { condition: "outer" });
    factory.finishSource();
    factory.finishLoop();

    expect(factory.result()).toEqual({
      target: 777,
      parameters: { condition: "outer" },
      active: true,
    });
  });
});
