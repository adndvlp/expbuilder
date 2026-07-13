import { beforeEach, vi } from "vitest";

const hoistedTrialCodeMock = vi.hoisted(() =>
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

const hoistedLoopCodeMock = vi.hoisted(() =>
  vi.fn(
    (props: any) => () =>
      JSON.stringify({
        id: props.id,
        trials: props.trials,
        unifiedStimuli: props.unifiedStimuli,
        isMergePoint: props.isMergePoint,
      }),
  ),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/useTrialCode",
  () => ({
    useTrialCode: hoistedTrialCodeMock,
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode",
  () => ({
    default: hoistedLoopCodeMock,
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
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

export function trial(overrides: Record<string, unknown> = {}) {
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

export function loop(overrides: Record<string, unknown> = {}) {
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

export const trialCodeMock = hoistedTrialCodeMock;
export const loopCodeMock = hoistedLoopCodeMock;

export function registerCodegenCoverageLifecycle() {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ timeline: [] }),
    })) as unknown as typeof fetch;
  });
}
