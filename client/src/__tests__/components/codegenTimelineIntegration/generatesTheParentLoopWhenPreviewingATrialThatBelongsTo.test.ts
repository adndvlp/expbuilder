import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAllCodes,
  generateSingleTrialCode,
} from "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import type { Trial } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import { loop, timelineTrial, trial } from "../../helpers/trialFactories";

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

  it("generates the parent loop when previewing a trial that belongs to a loop", async () => {
    const parentLoop = loop({
      id: "loop_flanker",
      name: "Flanker Loop",
      trials: [10],
      csvJson: [
        { Flanker: ">>>>>", CorrectResponse: "ArrowRight" },
        { Flanker: "<<<<<", CorrectResponse: "ArrowLeft" },
      ],
    });
    const loopTrial = trial({
      id: 10,
      name: "Task",
      plugin: "plugin-dynamic",
      parentLoopId: "loop_flanker",
      csvFromLoop: true,
      columnMapping: {
        components: {
          source: "typed",
          value: [
            {
              type: "TextComponent",
              text: { source: "csv", value: "Flanker" },
            },
          ],
        },
        response_components: { source: "typed", value: [] },
      },
    });
    const getTrial = vi.fn(async () => loopTrial);
    const getLoop = vi.fn(async () => parentLoop);
    const getLoopTimeline = vi.fn(async () => [
      timelineTrial({ id: 10, name: "Task" }),
    ]);

    const code = await generateSingleTrialCode(
      { id: 10 } as Trial,
      [],
      "experiment-1",
      getTrial,
      getLoopTimeline,
      getLoop,
    );

    expect(getLoop).toHaveBeenCalledWith("loop_flanker");
    expect(getLoopTimeline).toHaveBeenCalledWith("loop_flanker", false);
    expect(code).toContain("const test_stimuli_loop_flanker = [");
    expect(code).toContain('"text": ">>>>>"');
    expect(code).toContain('"text": "<<<<<"');
    expect(code).toContain("timeline.push(loop_flanker_procedure)");
    expect(code).not.toContain('text: {"source":"csv","value":"Flanker"}');
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
      "../../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader"
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
      generateAllCodes("experiment-1", [], vi.fn(), vi.fn(), vi.fn()),
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

  it("returns empty saved WebGazer code when none exists", async () => {
    const code = await generateSingleTrialCode(
      { id: 22 } as Trial,
      [],
      "experiment-1",
      vi.fn(async () =>
        trial({ id: 22, name: "WebGazer empty", plugin: "webgazer" }),
      ),
    );

    expect(code).toBe("");
  });

  it("falls back to trial generation when parent loop metadata is missing", async () => {
    const fullTrial = trial({
      id: 23,
      name: "Orphaned trial",
      plugin: "plugin-html-keyboard-response",
      parentLoopId: "missing-parent",
      columnMapping: undefined,
    });

    const code = await generateSingleTrialCode(
      { id: 23 } as Trial,
      [],
      "experiment-1",
      vi.fn(async () => fullTrial),
      vi.fn(async () => []),
      vi.fn(async () => null),
    );

    expect(code).toContain("Orphaned_trial");
  });
});
