import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSingleLoopCode } from "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import type { Loop } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
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
    expect(code).toContain(
      "timeline: [Loop_Trial_A_wrapper, Loop_Trial_B_wrapper]",
    );
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

  it("handles an empty nested loop entry in its parent loop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const parentLoop = loop({
      id: "parent-empty-child",
      name: "Parent empty child",
      trials: ["empty-child"],
    });
    const childLoop = loop({
      id: "empty-child",
      name: "Empty child",
      trials: [],
      parentLoopId: "parent-empty-child",
    });
    const getLoop = vi.fn(async (id: string | number) =>
      id === "parent-empty-child" ? parentLoop : childLoop,
    );
    const getLoopTimeline = vi.fn(async (id: string | number) =>
      id === "parent-empty-child"
        ? [timelineLoop({ id: "empty-child", name: "Empty child" })]
        : [],
    );

    const code = await generateSingleLoopCode(
      { id: "parent-empty-child" } as Loop,
      "experiment-1",
      [],
      vi.fn(),
      getLoopTimeline,
      getLoop,
    );

    expect(code).toBe("");
  });
});
