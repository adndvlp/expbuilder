import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAllCodes } from "../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import { loop, timelineLoop, timelineTrial, trial } from "../helpers/trialFactories";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
  () => ({
    loadPluginParameters: vi.fn(async (pluginName: string) => {
      if (pluginName === "plugin-dynamic") {
        return {
          parameters: [
            { key: "components", type: "complex", default: [] },
            { key: "response_components", type: "complex", default: [] },
            { key: "trial_duration", type: "number", default: null },
          ],
          data: [{ key: "response" }, { key: "rt" }],
        };
      }

      return {
        parameters: [
          { key: "stimulus", type: "html_string", default: "" },
          { key: "choices", type: "string_array", default: [" "] },
          { key: "trial_duration", type: "number", default: null },
        ],
        data: [{ key: "response" }, { key: "rt" }],
      };
    }),
  }),
);

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
              timelineTrial({ id: 1, name: "Dynamic Survey Trial", branches: [10] }),
              timelineLoop({ id: "loop_parent", name: "Parent Loop" }),
              timelineTrial({ id: 99, name: "WebGazer Setup" }),
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;
  });

  it("generates the mixed high-risk timeline without losing branch/loop scope", async () => {
    const topDynamicTrial = trial({
      id: 1,
      name: "Dynamic Survey Trial",
      plugin: "plugin-dynamic",
      branches: [10],
      branchConditions: [
        {
          id: 1,
          nextTrialId: 10,
          rules: [{ column: "response", op: "==", value: "continue" }],
        },
      ],
      columnMapping: {
        components: {
          source: "typed",
          value: [
            {
              type: "SurveyComponent",
              survey_json: {
                source: "typed",
                value: {
                  pages: [
                    {
                      name: "page-1",
                      elements: [{ type: "text", name: "participant_code" }],
                    },
                  ],
                },
              },
            },
          ],
        },
        response_components: {
          source: "typed",
          value: [
            {
              type: "ButtonResponseComponent",
              button_text: { source: "typed", value: "Continue" },
            },
          ],
        },
      },
    });

    const loopCsvTrial = trial({
      id: 10,
      name: "Loop CSV Trial",
      plugin: "plugin-html-keyboard-response",
      parentLoopId: "loop_parent",
      csvFromLoop: true,
      branches: [20],
      branchConditions: [
        {
          id: 2,
          nextTrialId: 20,
          rules: [{ column: "response", op: "==", value: "branch" }],
        },
      ],
      paramsOverride: [
        {
          id: 1,
          rules: [{ trialId: 1, column: "response", op: "==", value: "continue" }],
          paramsToOverride: {
            stimulus: { source: "typed", value: "<p>overridden</p>" },
          },
        },
      ],
      columnMapping: {
        stimulus: { source: "csv", value: "stimulus" },
        choices: { source: "typed", value: ["j", "k"] },
      },
    });

    const nestedTrial = trial({
      id: 20,
      name: "Nested Dynamic Trial",
      plugin: "plugin-dynamic",
      parentLoopId: "loop_child",
      columnMapping: {
        components: {
          source: "typed",
          value: [
            {
              type: "TextComponent",
              text: { source: "typed", value: "Nested text" },
            },
          ],
        },
        response_components: {
          source: "typed",
          value: [
            {
              type: "KeyboardResponseComponent",
              keys: { source: "typed", value: ["space"] },
            },
          ],
        },
      },
    });

    const webgazerTrial = trial({
      id: 99,
      name: "WebGazer Setup",
      plugin: "webgazer",
      trialCode: "const saved_webgazer_phase = { type: jsPsychWebgazerInitCamera };",
      csvJson: [{ phase: "init" }],
    });

    const parentLoop = loop({
      id: "loop_parent",
      name: "Parent Loop",
      trials: [10, "loop_child"],
      repetitions: 2,
      randomize: true,
      orders: true,
      stimuliOrders: [[1, 0]],
      categories: true,
      categoryData: ["practice", "main"],
      csvJson: [{ stimulus: "loop A" }, { stimulus: "loop B" }],
      isConditionalLoop: true,
      loopConditions: [
        {
          id: 1,
          rules: [
            {
              trialId: 10,
              column: "response",
              prop: "response",
              op: "==",
              value: "again",
            },
          ],
        },
      ],
      repeatConditions: [
        {
          id: 1,
          jumpToTrialId: 10,
          rules: [{ column: "response", prop: "response", op: "==", value: "jump" }],
        },
      ],
    });

    const childLoop = loop({
      id: "loop_child",
      name: "Child Loop",
      trials: [20],
      parentLoopId: "loop_parent",
      branches: [30],
      repetitions: 1,
      randomize: false,
    });

    const trials = new Map([
      [1, topDynamicTrial],
      [10, loopCsvTrial],
      [20, nestedTrial],
      [99, webgazerTrial],
    ]);
    const loops = new Map([
      ["loop_parent", parentLoop],
      ["loop_child", childLoop],
    ]);

    const getTrial = vi.fn(async (id: string | number) => trials.get(Number(id)) ?? null);
    const getLoop = vi.fn(async (id: string | number) => loops.get(String(id)) ?? null);
    const getLoopTimeline = vi.fn(async (id: string | number) =>
      id === "loop_parent"
        ? [
            timelineTrial({ id: 10, name: "Loop CSV Trial" }),
            timelineLoop({ id: "loop_child", name: "Child Loop", trials: [20] }),
          ]
        : [timelineTrial({ id: 20, name: "Nested Dynamic Trial" })],
    );

    const codes = await generateAllCodes(
      "mega-exp",
      [{ name: "face.png", url: "/uploads/face.png", type: "image/png" }],
      getTrial,
      getLoopTimeline,
      getLoop,
    );
    const combined = normalize(codes.join("\n"));

    expect(codes).toHaveLength(3);
    expect(getLoopTimeline).toHaveBeenCalledWith("loop_parent", false);
    expect(getLoopTimeline).toHaveBeenCalledWith("loop_child", false);

    expect(combined).toContain("const test_stimuli_Dynamic_Survey_Trial =");
    expect(combined).toContain("type: DynamicPlugin");
    expect(combined).toContain("SurveyComponent");
    expect(combined).toContain("ButtonResponseComponent");

    expect(combined).toContain("let test_stimuli_loop_parent = [];");
    expect(combined).toContain("const stimuliOrders = [[1,0]];");
    expect(combined).toContain('const categoryData = ["practice","main"];');
    expect(combined).toContain('"stimulus_Loop_CSV_Trial": "loop A"');
    expect(combined).toContain('"stimulus_Loop_CSV_Trial": "loop B"');
    expect(combined).toContain("const paramsOverrideConditions =");
    expect(combined).toContain("loop_function: function(data)");
    expect(combined).toContain("const loopConditionsArray =");
    expect(combined).toContain("const repeatConditionsArray =");
    expect(combined).toContain("localStorage.setItem('jsPsych_jumpToTrial'");

    expect(combined).toContain("loop_loop_parent_NextTrialId = nextTrialId;");
    expect(combined).toContain("loop_loop_parent_NextTrialId = branches[0];");
    expect(combined).toContain("loop_loop_parent_SkipRemaining = true;");
    expect(combined).not.toContain(
      "const branches = [30]; if (branches.length > 0) { window.nextTrialId = branches[0];",
    );

    expect(combined).toContain(
      "const saved_webgazer_phase = { type: jsPsychWebgazerInitCamera };",
    );
  });
});
