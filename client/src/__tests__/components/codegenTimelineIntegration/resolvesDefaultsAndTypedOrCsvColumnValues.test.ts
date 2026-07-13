import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAllCodes,
  getPluginDefaultValue,
  generateSingleTrialCode,
  resolveColumnValue,
} from "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import type { Trial } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import {
  loop,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
  () => ({
    loadPluginParameters: vi.fn(async (pluginName: string) => ({
      parameters:
        pluginName === "plugin-dynamic"
          ? [
              { key: "components", type: "complex" },
              { key: "response_components", type: "complex" },
              { key: "trial_duration", type: "number", default: null },
            ]
          : [
              { key: "stimulus", type: "html_string", default: "" },
              { key: "choices", type: "string_array", default: [" "] },
            ],
      data: [{ key: "response" }, { key: "rt" }],
    })),
  }),
);

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

describe("generateTrialLoopCodes integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        parameters: {
          stimulus: { type: "html_string", default: "" },
          choices: { type: "string_array", default: [" "] },
          components: { type: "complex", default: [] },
          response_components: { type: "complex", default: [] },
          trial_duration: { type: "number", default: null },
        },
        data: {
          response: { type: "string" },
          rt: { type: "number" },
        },
      }),
    })) as unknown as typeof fetch;
  });

  it("resolves defaults and typed or CSV column values", () => {
    const parameters = [
      { key: "without_default" },
      { key: "count", type: "number", default: 5 },
    ];

    expect(getPluginDefaultValue(parameters, "without_default")).toBe("");
    expect(getPluginDefaultValue(parameters, "missing")).toBe("");
    expect(resolveColumnValue(parameters, undefined)).toBe("");
    expect(resolveColumnValue(parameters, { source: "none" })).toBe("");
    expect(
      resolveColumnValue(parameters, { source: "typed", value: null }),
    ).toBe("");
    expect(
      resolveColumnValue(
        parameters,
        { source: "csv", value: 0 },
        { 0: "7" },
        undefined,
        "count",
      ),
    ).toBe(7);
    expect(
      resolveColumnValue(
        parameters,
        { source: "csv", value: {} },
        { count: "9" },
        undefined,
        "count",
      ),
    ).toBe(5);
    expect(
      resolveColumnValue(
        parameters,
        { source: "unsupported" },
        undefined,
        undefined,
        "count",
      ),
    ).toBe(5);
  });

  it("generates a single trial by fetching full trial data and plugin metadata", async () => {
    const fullTrial = trial({
      id: 1,
      name: "Generated Trial",
      plugin: "plugin-html-keyboard-response",
      csvJson: [{ StimulusColumn: "<p>Hello</p>" }],
      columnMapping: {
        stimulus: { source: "csv", value: "StimulusColumn" },
        choices: { source: "typed", value: ["y", "n"] },
      },
    });
    const getTrial = vi.fn(async () => fullTrial);

    const code = normalize(
      await generateSingleTrialCode(
        { id: 1 } as Trial,
        [],
        "experiment-1",
        getTrial,
      ),
    );

    expect(getTrial).toHaveBeenCalledWith(1);
    expect(code).toContain("const test_stimuli_Generated_Trial =");
    expect(code).toContain("type: jsPsychHtmlKeyboardResponse");
    expect(code).toContain('stimulus: jsPsych.timelineVariable("stimulus")');
    expect(code).toContain("timeline.push(Generated_Trial_procedure)");
  });

  it("generates all top-level trial and loop codes from timeline metadata", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (String(url).includes("/api/trials-metadata/experiment-1")) {
        return {
          ok: true,
          json: async () => ({
            timeline: [
              timelineTrial({ id: 1, name: "Top Trial" }),
              timelineLoop({ id: "loop_1", name: "Loop 1", trials: [10] }),
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;
    const topTrial = trial({
      id: 1,
      name: "Top Trial",
      plugin: "plugin-html-keyboard-response",
      columnMapping: {
        stimulus: { source: "typed", value: "Top" },
      },
    });
    const fullLoop = loop({
      id: "loop_1",
      name: "Loop 1",
      trials: [10],
    });
    const loopTrial = trial({
      id: 10,
      name: "Loop Trial",
      plugin: "plugin-html-keyboard-response",
      parentLoopId: "loop_1",
      columnMapping: {
        stimulus: { source: "typed", value: "Inside" },
      },
    });
    const getTrial = vi.fn(async (id: string | number) =>
      id === 1 ? topTrial : loopTrial,
    );
    const getLoop = vi.fn(async () => fullLoop);
    const getLoopTimeline = vi.fn(async () => [
      timelineTrial({ id: 10, name: "Loop Trial" }),
    ]);

    const codes = await generateAllCodes(
      "experiment-1",
      [],
      getTrial,
      getLoopTimeline,
      getLoop,
    );

    expect(codes).toHaveLength(2);
    expect(normalize(codes[0])).toContain("timeline.push(Top_Trial_procedure)");
    expect(normalize(codes[1])).toContain("const loop_1_procedure = {");
    expect(getLoopTimeline).toHaveBeenCalledWith("loop_1", false);
  });

  it("handles missing timelines and top-level items that produce no code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          timeline: [
            timelineLoop({ id: "missing-loop", name: "Missing loop" }),
            { id: "group", type: "group", name: "Unsupported group" },
          ],
        }),
      } as Response) as unknown as typeof fetch;

    const getLoop = vi.fn(async () => null);

    await expect(
      generateAllCodes("experiment-empty", [], vi.fn(), vi.fn(), getLoop),
    ).resolves.toEqual([]);
    await expect(
      generateAllCodes("experiment-items", [], vi.fn(), vi.fn(), getLoop),
    ).resolves.toEqual([]);

    expect(getLoop).toHaveBeenCalledWith("missing-loop");
  });

  it("marks top-level shared branch targets as merge points in generated code", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (String(url).includes("/api/trials-metadata/experiment-merge")) {
        return {
          ok: true,
          json: async () => ({
            timeline: [
              timelineTrial({ id: 1, name: "Randomizer", branches: [2, 3] }),
              timelineTrial({ id: 2, name: "Control", branches: [4] }),
              timelineTrial({ id: 3, name: "Intervention", branches: [4] }),
              timelineTrial({ id: 4, name: "Shared Target" }),
              timelineTrial({ id: 5, name: "After Merge" }),
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;

    const getTrial = vi.fn(async (id: string | number) =>
      trial({
        id: Number(id),
        name:
          id === 4 ? "Shared Target" : id === 5 ? "After Merge" : `Trial ${id}`,
        plugin: "plugin-html-keyboard-response",
        branches: id === 1 ? [2, 3] : id === 2 || id === 3 ? [4] : [],
        columnMapping: {
          stimulus: { source: "typed", value: `Stimulus ${id}` },
        },
      }),
    );

    const codes = await generateAllCodes(
      "experiment-merge",
      [],
      getTrial,
      vi.fn(),
      vi.fn(),
    );
    const sharedTargetCode = normalize(
      codes.find((code) => code.includes("Shared_Target_timeline")) || "",
    );

    expect(sharedTargetCode).toContain("window.nextTrialId = null;");
    expect(sharedTargetCode).toContain("window.skipRemaining = false;");
    expect(sharedTargetCode).toContain("window.branchingActive = false;");
    expect(sharedTargetCode).not.toContain("jsPsych.abortExperiment");
  });
});
