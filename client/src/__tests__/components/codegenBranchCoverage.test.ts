import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAllCodes,
  generateSingleLoopCode,
  generateSingleTrialCode,
} from "../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import BranchesCode from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/BranchesCode";

const trialCodeMock = vi.hoisted(() =>
  vi.fn((props: any) => {
    const row = {
      intCol: "7",
      badIntCol: "not-a-number",
      floatCol: "2.5",
      badFloatCol: "nope",
      boolTrueCol: "1",
      boolFalseCol: "false",
      boolRawCol: true,
      plainCol: "plain text",
    };
    const values = {
      noneWithDefault: props.getColumnValue(undefined, undefined, "fallback"),
      noneWithKeyDefault: props.getColumnValue(
        { source: "none" },
        undefined,
        undefined,
        "defaulted",
      ),
      typedDefault: props.getColumnValue(
        { source: "typed", value: undefined },
        undefined,
        undefined,
        "typedDefault",
      ),
      intValue: props.getColumnValue(
        { source: "csv", value: "intCol" },
        row,
        undefined,
        "intParam",
      ),
      badIntValue: props.getColumnValue(
        { source: "csv", value: "badIntCol" },
        row,
        undefined,
        "intParam",
      ),
      floatValue: props.getColumnValue(
        { source: "csv", value: "floatCol" },
        row,
        undefined,
        "floatParam",
      ),
      badFloatValue: props.getColumnValue(
        { source: "csv", value: "badFloatCol" },
        row,
        undefined,
        "floatParam",
      ),
      boolRawValue: props.getColumnValue(
        { source: "csv", value: "boolRawCol" },
        row,
        undefined,
        "boolParam",
      ),
      boolTrueValue: props.getColumnValue(
        { source: "csv", value: "boolTrueCol" },
        row,
        undefined,
        "boolParam",
      ),
      boolFalseValue: props.getColumnValue(
        { source: "csv", value: "boolFalseCol" },
        row,
        undefined,
        "boolParam",
      ),
      missingParamValue: props.getColumnValue(
        { source: "csv", value: "plainCol" },
        row,
        undefined,
        "missingParam",
      ),
      unknownCsvMapping: props.getColumnValue(
        { source: "csv", value: { nested: "key" } },
        row,
      ),
    };

    return {
      mappedJson: [values],
      genTrialCode: () =>
        JSON.stringify({
          values,
          csvJson: props.csvJson,
          includesExtensions: props.includesExtensions,
          isMergePoint: props.isMergePoint,
        }),
    };
  }),
);

const loopCodeMock = vi.hoisted(() =>
  vi.fn((props: any) => () =>
    JSON.stringify({
      id: props.id,
      trials: props.trials,
      unifiedStimuli: props.unifiedStimuli,
      isMergePoint: props.isMergePoint,
    }),
  ),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/useTrialCode",
  () => ({
    useTrialCode: trialCodeMock,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode",
  () => ({
    default: loopCodeMock,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
  () => ({
    loadPluginParameters: vi.fn(async () => ({
      parameters: [
        { key: "defaulted", type: "string", default: "from-default" },
        { key: "typedDefault", type: "string", default: "typed-default" },
        { key: "intParam", type: "number", default: 0 },
        { key: "floatParam", type: "float", default: 0 },
        { key: "boolParam", type: "boolean", default: false },
      ],
      data: [{ key: "response" }],
    })),
  }),
);

function trial(overrides: Record<string, unknown> = {}) {
  return {
    id: "trial-a",
    type: "trial",
    name: "Trial A",
    plugin: "plugin-html-keyboard-response",
    parameters: {},
    columnMapping: {},
    branches: [],
    ...overrides,
  } as any;
}

function loop(overrides: Record<string, unknown> = {}) {
  return {
    id: "loop-a",
    name: "Loop A",
    trials: [],
    branches: [],
    repetitions: 1,
    randomize: false,
    ...overrides,
  } as any;
}

describe("generateTrialLoopCodes branch coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ timeline: [] }),
    })) as unknown as typeof fetch;
  });

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

  it("returns empty loop code when loop timeline loading throws", async () => {
    const code = await generateSingleLoopCode(
      { id: "loop-a" } as any,
      "experiment-a",
      [],
      vi.fn(),
      vi.fn(async () => {
        throw new Error("timeline failed");
      }),
      vi.fn(async () => loop({ id: "loop-a" })),
    );

    expect(code).toBe("");
    expect(console.error).toHaveBeenCalledWith(
      "Error generating code for loop loop-a:",
      expect.any(Error),
    );
  });

  it("generates empty branch arrays when branch metadata is absent", () => {
    const automatic = BranchesCode({
      code: "",
      hasBranchesLoop: true,
      branches: undefined,
      branchConditions: [],
      repeatConditions: [],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
      id: "loop-a",
    } as any).code;
    const repeated = BranchesCode({
      code: "",
      hasBranchesLoop: true,
      branches: undefined,
      branchConditions: [],
      repeatConditions: [{ rules: [] }],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
      id: "loop-a",
    } as any).code;

    expect(automatic).toContain("const branches = [];");
    expect(repeated).toContain("const branches = [];");
  });

  it("resets branch state for terminal merge-point loops", () => {
    const terminal = BranchesCode({
      code: "",
      hasBranchesLoop: false,
      branches: [],
      branchConditions: [],
      repeatConditions: [],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
      isMergePoint: true,
      id: "loop-a",
    } as any).code;
    const repeatedTerminal = BranchesCode({
      code: "",
      hasBranchesLoop: false,
      branches: [],
      branchConditions: [],
      repeatConditions: [{ rules: [] }],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
      isMergePoint: true,
      id: "loop-a",
    } as any).code;

    expect(terminal).toContain("window.nextTrialId = null;");
    expect(repeatedTerminal).toContain("window.nextTrialId = null;");
  });
});
