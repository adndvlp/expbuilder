import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAllCodes } from "../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import { toCodeIdentifier } from "../../pages/ExperimentBuilder/utils/codegen/codeIdentifier";
import { getBranchEvaluatorRuntimeCode } from "../../pages/ExperimentBuilder/modules/experiment-runtime/branchEvaluator";
import { timelineLoop, timelineTrial } from "../helpers/trialFactories";
import { createMegaFixture } from "./codegenMegaFixture/fixture";

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

describe("codegen mega regression fixture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/trials-metadata/mega-exp") {
        return {
          ok: true,
          json: async () => ({
            timeline: [
              timelineTrial({
                id: 1,
                name: "Dynamic Survey Trial",
                branches: [10],
              }),
              timelineLoop({ id: "loop_parent", name: "Parent Loop" }),
              timelineTrial({ id: 99, name: "WebGazer Setup" }),
            ],
          }),
        } as Response;
      }
      const dynamic = url.endsWith("/api/metadata/plugin-dynamic.json");
      return {
        ok: true,
        json: async () => ({
          parameters: dynamic
            ? {
                components: { type: "complex", default: [] },
                response_components: { type: "complex", default: [] },
                trial_duration: { type: "number", default: null },
              }
            : {
                stimulus: { type: "html_string", default: "" },
                choices: { type: "string_array", default: [" "] },
                trial_duration: { type: "number", default: null },
              },
          data: { response: { type: "string" }, rt: { type: "number" } },
        }),
      } as Response;
    }) as unknown as typeof fetch;
  });

  it("generates the mixed high-risk timeline without losing branch/loop scope", async () => {
    const { getTrial, getLoop, getLoopTimeline } = createMegaFixture();

    const codes = await generateAllCodes(
      "mega-exp",
      [{ name: "face.png", url: "/uploads/face.png", type: "image/png" }],
      getTrial,
      getLoopTimeline,
      getLoop,
    );
    const combined = normalize(codes.join("\n"));
    expect(console.error).not.toHaveBeenCalled();

    expect(codes).toHaveLength(3);
    expect(getLoopTimeline).toHaveBeenCalledWith("loop_parent", {
      mode: "query",
    });
    expect(getLoopTimeline).toHaveBeenCalledWith("loop_child", {
      mode: "query",
    });

    expect(combined).toContain(
      `const test_stimuli_${toCodeIdentifier("Dynamic Survey Trial")} =`,
    );
    expect(combined).toContain("type: DynamicPlugin");
    expect(combined).toContain("SurveyComponent");
    expect(combined).toContain("ButtonResponseComponent");

    expect(combined).toContain("let test_stimuli_loop_parent = [];");
    expect(combined).toContain("const stimuliOrders = [[1,0]];");
    expect(combined).toContain('const categoryData = ["practice","main"];');
    const loopTrialIdentifier = toCodeIdentifier("Loop CSV Trial");
    expect(combined).toContain(`"stimulus_${loopTrialIdentifier}": "loop A"`);
    expect(combined).toContain(`"stimulus_${loopTrialIdentifier}": "loop B"`);
    expect(combined).toContain("const paramsOverrideConditions =");
    expect(combined).toContain("loop_function: function(data)");
    expect(combined).toContain("const loopConditions =");
    expect(combined).toContain("window.ExpBuilderNavigation?.requestBranch(");

    expect(combined).toContain(
      "const saved_webgazer_phase = { type: jsPsychWebgazerInitCamera };",
    );

    type GeneratedNode = {
      timeline?: GeneratedNode[];
      on_finish?: (data: Record<string, unknown>) => void;
    };
    const registeredTrials = new Map<number, GeneratedNode>();
    const registeredLoops = new Map<string, GeneratedNode>();
    const requestBranch = vi.fn();
    const runtimeWindow = {
      ExpBuilderNavigation: {
        registerTrial: (id: number, node: GeneratedNode) =>
          registeredTrials.set(id, node),
        registerLoop: (id: string, node: GeneratedNode) =>
          registeredLoops.set(id, node),
        requestBranch,
      },
      ExpBuilderRuntime: { emit: vi.fn() },
    };
    const timeline = new Function(
      "window",
      "jsPsych",
      `
      const timeline = []; const participantNumber = 1; const trialSessionId = 'mega';
      const DynamicPlugin = {}; const jsPsychHtmlKeyboardResponse = {};
      const jsPsychWebgazerInitCamera = {};
      ${getBranchEvaluatorRuntimeCode()}
      ${codes.join("\n")}
      return timeline;
    `,
    )(runtimeWindow, {
      timelineVariable: (name: string) => ({ variable: name }),
    });

    expect([...registeredTrials.keys()].sort((a, b) => a - b)).toEqual([
      1, 10, 20, 99,
    ]);
    const parent = registeredLoops.get("loop_parent");
    const child = registeredLoops.get("loop_child");
    expect(parent?.timeline).toEqual([registeredTrials.get(10), child]);
    expect(child?.timeline).toEqual([registeredTrials.get(20)]);
    expect(timeline).toEqual([
      registeredTrials.get(1),
      parent,
      registeredTrials.get(99),
    ]);
    expect(registeredTrials.get(99)?.timeline?.[0].timeline).toHaveLength(1);

    const surveyData = { builder_id: 1, response: "continue" };
    const loopData = { builder_id: 10, response: "branch" };
    registeredTrials.get(1)?.timeline?.[0].on_finish?.(surveyData);
    registeredTrials.get(10)?.on_finish?.(loopData);
    expect(requestBranch).toHaveBeenCalledTimes(2);
    expect(requestBranch).toHaveBeenNthCalledWith(
      1,
      surveyData,
      expect.objectContaining({
        targetId: 10,
        conditionId: 1,
        usedDefault: false,
      }),
    );
    expect(requestBranch).toHaveBeenNthCalledWith(
      2,
      loopData,
      expect.objectContaining({
        targetId: 20,
        conditionId: 2,
        usedDefault: false,
      }),
    );
  });
});
