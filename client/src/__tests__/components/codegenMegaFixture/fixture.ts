import { vi } from "vitest";
import {
  loop,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";

export function createMegaFixture() {
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
        rules: [
          { trialId: 1, column: "response", op: "==", value: "continue" },
        ],
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
    trialCode:
      "const saved_webgazer_phase = { type: jsPsychWebgazerInitCamera }; timeline.push(saved_webgazer_phase);",
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
  });

  const childLoop = loop({
    id: "loop_child",
    name: "Child Loop",
    trials: [20],
    parentLoopId: "loop_parent",
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

  const getTrial = vi.fn(
    async (id: string | number) => trials.get(Number(id)) ?? null,
  );
  const getLoop = vi.fn(
    async (id: string | number) => loops.get(String(id)) ?? null,
  );
  const getLoopTimeline = vi.fn(async (id: string | number) =>
    id === "loop_parent"
      ? [
          timelineTrial({ id: 10, name: "Loop CSV Trial" }),
          timelineLoop({
            id: "loop_child",
            name: "Child Loop",
            trials: [20],
          }),
        ]
      : [timelineTrial({ id: 20, name: "Nested Dynamic Trial" })],
  );
  return { getTrial, getLoop, getLoopTimeline };
}
