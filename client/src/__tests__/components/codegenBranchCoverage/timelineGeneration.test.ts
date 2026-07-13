import { describe, expect, it } from "vitest";
import { loop, registerCodegenCoverageLifecycle, trial } from "./testHarness";
import {
  generateAllCodes,
  generateSingleLoopCode,
  generateSingleTrialCode,
} from "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";

describe("generateTrialLoopCodes branch coverage", () => {
  registerCodegenCoverageLifecycle();
  it("converts CSV mapped values through getColumnValue branch rules", async () => {
    const code = await generateSingleTrialCode(
      { id: "trial-a" } as any,
      [],
      "experiment-a",
      vi.fn(async () =>
        trial({
          csvJson: [{ row: 1 }],
          parameters: {
            includesExtensions: true,
            extensionType: "jsPsychExtensionWebgazer",
          },
        }),
      ),
    );

    expect(JSON.parse(code)).toEqual({
      values: {
        noneWithDefault: "fallback",
        noneWithKeyDefault: "from-default",
        typedDefault: "typed-default",
        intValue: 7,
        badIntValue: 0,
        floatValue: 2.5,
        badFloatValue: 0,
        boolRawValue: true,
        boolTrueValue: true,
        boolFalseValue: false,
        missingParamValue: "plain text",
        unknownCsvMapping: "",
      },
      csvJson: [{ row: 1 }],
      includesExtensions: true,
      isMergePoint: false,
    });
  });

  it("returns no top-level code when timeline trial data is missing", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        timeline: [{ id: "missing-trial", type: "trial", name: "Missing" }],
      }),
    })) as unknown as typeof fetch;

    const codes = await generateAllCodes(
      "experiment-a",
      [],
      vi.fn(async () => null),
      vi.fn(),
      vi.fn(),
    );

    expect(codes).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to fetch trial missing-trial",
    );
  });

  it("keeps loop code generation alive for missing trials, missing nested loops, and unknown items", async () => {
    const code = await generateSingleLoopCode(
      { id: "loop-a" } as any,
      "experiment-a",
      [],
      vi.fn(async () => null),
      vi.fn(async () => [
        { id: "missing-trial", type: "trial", name: "Missing Trial" },
        { id: "missing-loop", type: "loop", name: "Missing Loop" },
        { id: "other", type: "marker", name: "Marker" },
      ]),
      vi.fn(async (id: string | number) =>
        id === "loop-a" ? loop({ id: "loop-a" }) : null,
      ),
    );

    const parsed = JSON.parse(code);
    expect(parsed.trials).toEqual([
      {
        trialName: "Missing Trial",
        pluginName: "",
        timelineProps: "",
        mappedJson: [],
      },
      {
        id: "missing-loop",
        type: "loop",
        name: "Missing Loop",
        timelineProps: "",
        isLoop: true,
      },
      { id: "other", type: "marker", name: "Marker" },
    ]);
    expect(parsed.unifiedStimuli).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to fetch trial missing-trial",
    );
    expect(console.error).toHaveBeenCalledWith(
      "🔁 [GENERATE LOOP] Failed to fetch nested loop missing-loop",
    );
  });
});
