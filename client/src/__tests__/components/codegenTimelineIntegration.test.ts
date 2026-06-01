import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAllCodes,
  generateSingleLoopCode,
  generateSingleTrialCode,
} from "../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import type {
  Loop,
  Trial,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import { loop, timelineLoop, timelineTrial, trial } from "../helpers/trialFactories";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
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

  it("generates a single trial by fetching full trial data and plugin metadata", async () => {
    const fullTrial = trial({
      id: 1,
      name: "Generated Trial",
      plugin: "plugin-html-keyboard-response",
      columnMapping: {
        stimulus: { source: "typed", value: "<p>Hello</p>" },
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

  it("returns empty code when the full trial is missing or has no plugin", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      generateSingleTrialCode(
        { id: 404 } as Trial,
        [],
        "experiment-1",
        vi.fn(async () => null),
      ),
    ).resolves.toBe("");

    await expect(
      generateSingleTrialCode(
        { id: 2 } as Trial,
        [],
        "experiment-1",
        vi.fn(async () => trial({ id: 2, plugin: "" })),
      ),
    ).resolves.toBe("");

    expect(console.error).toHaveBeenCalledWith("Failed to fetch trial 404");
    expect(console.error).toHaveBeenCalledWith("Trial 2 has no plugin");
  });

  it("returns empty code when plugin parameter loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadPluginParameters } = await import(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader"
    );
    vi.mocked(loadPluginParameters).mockRejectedValueOnce(
      new Error("metadata failed"),
    );

    const code = await generateSingleTrialCode(
      { id: 3 } as Trial,
      [],
      "experiment-1",
      vi.fn(async () =>
        trial({
          id: 3,
          plugin: "plugin-html-keyboard-response",
          columnMapping: {
            stimulus: { source: "typed", value: "A" },
          },
        }),
      ),
    );

    expect(code).toBe("");
    expect(console.error).toHaveBeenCalledWith(
      "Error generating code for trial 3:",
      expect.any(Error),
    );
  });

  it("returns empty arrays when top-level metadata cannot be fetched", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(
      generateAllCodes(
        "experiment-1",
        [],
        vi.fn(),
        vi.fn(),
        vi.fn(),
      ),
    ).resolves.toEqual([]);

    expect(console.error).toHaveBeenCalledWith(
      "Error generating codes:",
      expect.any(Error),
    );
  });

  it("returns saved WebGazer code without loading plugin parameters", async () => {
    const savedCode = "const saved_webgazer_phase = { type: webgazer };";
    const getTrial = vi.fn(async () =>
      trial({
        id: 2,
        name: "WebGazer",
        plugin: "webgazer",
        trialCode: savedCode,
      }),
    );

    const code = await generateSingleTrialCode(
      { id: 2 } as Trial,
      [],
      "experiment-1",
      getTrial,
    );

    expect(code).toBe(savedCode);
  });

  it("generates loop code with updateState=false loop fetches and unified child stimuli", async () => {
    const fullLoop = loop({
      id: "loop_1",
      name: "Practice Loop",
      trials: [10, 11],
      repetitions: 2,
      randomize: true,
    });
    const trialA = trial({
      id: 10,
      name: "Loop Trial A",
      plugin: "plugin-html-keyboard-response",
      parentLoopId: "loop_1",
      columnMapping: {
        stimulus: { source: "typed", value: "A" },
      },
    });
    const trialB = trial({
      id: 11,
      name: "Loop Trial B",
      plugin: "plugin-html-keyboard-response",
      parentLoopId: "loop_1",
      columnMapping: {
        stimulus: { source: "typed", value: "B" },
      },
    });
    const getLoop = vi.fn(async () => fullLoop);
    const getLoopTimeline = vi.fn(async () => [
      timelineTrial({ id: 10, name: "Loop Trial A" }),
      timelineTrial({ id: 11, name: "Loop Trial B" }),
    ]);
    const getTrial = vi.fn(async (id: string | number) =>
      id === 10 ? trialA : trialB,
    );

    const code = normalize(
      await generateSingleLoopCode(
        { id: "loop_1" } as Loop,
        "experiment-1",
        [],
        getTrial,
        getLoopTimeline,
        getLoop,
      ),
    );

    expect(getLoopTimeline).toHaveBeenCalledWith("loop_1", false);
    expect(code).toContain("const test_stimuli_loop_1 = [");
    expect(code).toContain('"stimulus_Loop_Trial_A": "A"');
    expect(code).toContain('"stimulus_Loop_Trial_B": "B"');
    expect(code).toContain("timeline: [Loop_Trial_A_wrapper, Loop_Trial_B_wrapper]");
    expect(code).toContain("repetitions: 2");
    expect(code).toContain("randomize_order: true");
  });

  it("returns empty loop code when loop metadata is missing or loop timeline is empty", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      generateSingleLoopCode(
        { id: "missing_loop" } as Loop,
        "experiment-1",
        [],
        vi.fn(),
        vi.fn(),
        vi.fn(async () => null),
      ),
    ).resolves.toBe("");

    await expect(
      generateSingleLoopCode(
        { id: "empty_loop" } as Loop,
        "experiment-1",
        [],
        vi.fn(),
        vi.fn(async () => []),
        vi.fn(async () => loop({ id: "empty_loop", trials: [] })),
      ),
    ).resolves.toBe("");

    expect(console.error).toHaveBeenCalledWith(
      "Failed to fetch loop missing_loop",
    );
    expect(console.error).toHaveBeenCalledWith(
      "ERROR: trialsWithCode is empty or undefined!",
    );
  });

  it("preserves parent loop scope when recursively generating nested loop code", async () => {
    const parentLoop = loop({
      id: "loop_parent",
      name: "Parent Loop",
      trials: ["loop_child"],
      repetitions: 1,
      randomize: false,
    });
    const childLoop = loop({
      id: "loop_child",
      name: "Child Loop",
      trials: [20],
      branches: [99],
      parentLoopId: "loop_parent",
      repetitions: 1,
      randomize: false,
    });
    const nestedTrial = trial({
      id: 20,
      name: "Nested Trial",
      plugin: "plugin-html-keyboard-response",
      parentLoopId: "loop_child",
      columnMapping: {
        stimulus: { source: "typed", value: "Nested" },
      },
    });
    const getLoop = vi.fn(async (id: string | number) =>
      id === "loop_parent" ? parentLoop : childLoop,
    );
    const getLoopTimeline = vi.fn(async (id: string | number) =>
      id === "loop_parent"
        ? [timelineLoop({ id: "loop_child", name: "Child Loop", trials: [20] })]
        : [timelineTrial({ id: 20, name: "Nested Trial" })],
    );
    const getTrial = vi.fn(async () => nestedTrial);

    const code = normalize(
      await generateSingleLoopCode(
        { id: "loop_parent" } as Loop,
        "experiment-1",
        [],
        getTrial,
        getLoopTimeline,
        getLoop,
      ),
    );

    expect(getLoopTimeline).toHaveBeenCalledWith("loop_parent", false);
    expect(getLoopTimeline).toHaveBeenCalledWith("loop_child", false);
    expect(code).toContain("loop_loop_parent_NextTrialId = branches[0];");
    expect(code).toContain("loop_loop_parent_SkipRemaining = true;");
    expect(code).toContain("loop_loop_parent_BranchingActive = true;");
    expect(code).not.toContain(
      "const branches = [99]; if (branches.length > 0) { window.nextTrialId = branches[0];",
    );
  });
});
