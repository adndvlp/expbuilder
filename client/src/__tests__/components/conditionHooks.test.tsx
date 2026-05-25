import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useParamsOverride } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/useParamsOverride";
import { useConditionalLoop } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/useConditionalLoop";
import type {
  Loop,
  ParamsOverrideCondition,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { LoopCondition } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/types";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  loadPluginParameters: vi.fn(),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
  () => ({
    loadPluginParameters: mocks.loadPluginParameters,
  }),
);

const currentParameters = [
  { key: "stimulus", label: "Stimulus", type: "html_string", default: "" },
  { key: "choices", label: "Choices", type: "string_array", default: [] },
];

const previousData = [
  { key: "response", label: "Response", type: "string" },
  { key: "rt", label: "RT", type: "number" },
];

function installTrialsContext(overrides: Partial<any> = {}) {
  mocks.trialsContext = {
    timeline: [
      { id: 1, name: "Intro" },
      { id: 2, name: "Prime" },
      { id: 3, name: "Current" },
    ],
    loopTimeline: [
      { id: 1, name: "Loop Intro" },
      { id: 2, name: "Loop Prime" },
      { id: 3, name: "Loop Current" },
      { id: "loop_2", name: "Nested Loop" },
    ],
    activeLoopId: "loop_1",
    getTrial: vi.fn(async (id: string | number) => ({
      id,
      name: `Trial ${id}`,
      plugin: id === 3 ? "plugin-current" : "plugin-previous",
    })),
    getLoop: vi.fn(async (id: string | number) => ({
      id,
      name: `Loop ${id}`,
      trials: [],
    })),
    getLoopTimeline: vi.fn(async () => []),
    updateTrial: vi.fn(async (id: string | number, data: unknown) => ({
      id,
      name: "Updated",
      ...data,
    })),
    setSelectedTrial: vi.fn(),
    ...overrides,
  };
}

describe("condition state hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    installTrialsContext();
    mocks.loadPluginParameters.mockImplementation(async (pluginName: string) => ({
      parameters:
        pluginName === "plugin-current"
          ? currentParameters
          : [{ key: "prompt", label: "Prompt", type: "html_string" }],
      data: previousData,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads ParamsOverride conditions, current params and previous trial data fields", async () => {
    const paramsOverride: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 2, column: "response", op: "==", value: "yes" }],
        paramsToOverride: {},
      },
    ];
    const selectedTrial = {
      id: 3,
      name: "Loop Current",
      plugin: "plugin-current",
      parentLoopId: "loop_1",
      csvColumns: ["stimulus_col"],
      paramsOverride,
    };

    const { result } = renderHook(() => useParamsOverride(selectedTrial));

    await waitFor(() => {
      expect(result.current.currentTrialParameters).toEqual(currentParameters);
    });
    await waitFor(() => {
      expect(result.current.trialDataFields[2]).toEqual(previousData);
    });

    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith("loop_1");
    expect(result.current.conditions).toEqual(paramsOverride);
    expect(result.current.findTrialByIdSync(2)).toEqual({
      id: 2,
      name: "Trial 2",
      plugin: "plugin-previous",
    });
    expect(result.current.getAvailableTrials()).toEqual([
      { id: 1, name: "Loop Intro" },
      { id: 2, name: "Loop Prime" },
    ]);
    expect(result.current.getAvailableTrialsForCondition(1)).toEqual([
      { id: 1, name: "Loop Intro" },
    ]);
    expect(result.current.getCurrentTrialCsvColumns()).toEqual(["stimulus_col"]);
  });

  it("autosaves ParamsOverride condition updates and refreshes selectedTrial", async () => {
    vi.useFakeTimers();
    const selectedTrial = {
      id: 3,
      name: "Current",
      plugin: "plugin-current",
      paramsOverride: [],
    };
    const newConditions: ParamsOverrideCondition[] = [
      {
        id: 10,
        rules: [{ trialId: 1, column: "response", op: "==", value: "left" }],
        paramsToOverride: {
          stimulus: { source: "typed", value: "<p>Changed</p>" },
        },
      },
    ];

    const { result } = renderHook(() => useParamsOverride(selectedTrial));

    act(() => {
      result.current.setConditionsWrapper(newConditions, true);
    });

    expect(result.current.conditions).toEqual(newConditions);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(3, {
      paramsOverride: newConditions,
    });
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith({
      id: 3,
      name: "Updated",
      paramsOverride: newConditions,
    });
    expect(result.current.saveIndicator).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.saveIndicator).toBe(false);
  });

  it("loads ConditionalLoop conditions, filters used targets and loads loop/trial metadata", async () => {
    const loopCondition: LoopCondition = {
      id: 1,
      rules: [{ trialId: 1, column: "response", op: "==", value: "yes" }],
    };
    const loop = {
      id: "loop_1",
      name: "Parent Loop",
      loopConditions: [loopCondition],
    } as Loop;
    const onSave = vi.fn();

    const { result } = renderHook(() => useConditionalLoop(loop, onSave));

    await waitFor(() => {
      expect(result.current.trialDataFields[1]).toEqual(previousData);
    });

    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith("loop_1");
    expect(result.current.conditions).toEqual([loopCondition]);
    expect(result.current.getAvailableTrials(1)).toEqual([
      { id: 2, name: "Loop Prime" },
      { id: 3, name: "Loop Current" },
      { id: "loop_2", name: "Nested Loop" },
    ]);

    let nestedLoop: unknown;
    await act(async () => {
      nestedLoop = await result.current.loadTrialOrLoop("loop_2");
    });

    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop_2");
    expect(nestedLoop).toEqual({
      id: "loop_2",
      name: "Loop loop_2",
      trials: [],
    });

    let trial: unknown;
    await act(async () => {
      trial = await result.current.loadTrialOrLoop(2);
    });

    expect(mocks.trialsContext.getTrial).toHaveBeenCalledWith(2);
    expect(trial).toEqual({
      id: 2,
      name: "Trial 2",
      plugin: "plugin-previous",
    });
  });

  it("autosaves ConditionalLoop updates through the provided onSave callback", () => {
    vi.useFakeTimers();
    const loop = {
      id: "loop_1",
      name: "Parent Loop",
      loopConditions: [],
    } as Loop;
    const onSave = vi.fn();
    const newConditions: LoopCondition[] = [
      {
        id: 2,
        rules: [{ trialId: 1, column: "rt", op: ">", value: "500" }],
      },
    ];

    const { result } = renderHook(() => useConditionalLoop(loop, onSave));

    act(() => {
      result.current.setConditionsWrapper(newConditions, true);
    });

    expect(result.current.conditions).toEqual(newConditions);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledWith(newConditions);
    expect(result.current.saveIndicator).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.saveIndicator).toBe(false);
  });
});
