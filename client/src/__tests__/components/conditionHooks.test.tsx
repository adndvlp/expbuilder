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
    vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(result.current.findTrialByIdSync("missing")).toBeNull();
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

  it("handles missing ParamsOverride trial data and disables optional autosave", async () => {
    const { result } = renderHook(() => useParamsOverride(null));

    await waitFor(() => {
      expect(result.current.currentTrialParameters).toEqual([]);
    });

    expect(result.current.conditions).toEqual([]);
    expect(result.current.getAvailableTrials()).toEqual([]);
    expect(result.current.getAvailableTrialsForCondition(404)).toEqual([]);
    expect(result.current.getCurrentTrialCsvColumns()).toEqual([]);
    expect(result.current.findTrialByIdSync(null)).toBeNull();

    await act(async () => {
      await result.current.handleSaveConditions();
    });
    expect(mocks.trialsContext.updateTrial).not.toHaveBeenCalled();

    act(() => {
      result.current.setConditionsWrapper([], false);
    });
    expect(result.current.conditions).toEqual([]);
  });

  it("reports current parameter loading failures", async () => {
    const error = new Error("metadata failed");
    const selectedTrial = {
      id: 3,
      name: "Current",
      plugin: "plugin-current",
      paramsOverride: [],
    };
    mocks.loadPluginParameters.mockImplementationOnce(() => {
      throw error;
    });

    renderHook(() => useParamsOverride(selectedTrial));

    await act(async () => {
      await Promise.resolve();
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error loading current trial parameters:",
      error,
    );
  });

  it("covers ParamsOverride trial lookup guards and load failures", async () => {
    const selectedTrial = {
      id: 3,
      name: "Current",
      plugin: "plugin-current",
      paramsOverride: [],
    };
    const getTrial = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 5, name: "No Plugin" })
      .mockResolvedValueOnce({
        id: 6,
        name: "Broken Metadata",
        plugin: "plugin-broken",
      });
    installTrialsContext({ getTrial });
    mocks.loadPluginParameters.mockImplementation(async (pluginName: string) => {
      if (pluginName === "plugin-broken") {
        throw new Error("trial metadata failed");
      }
      return { parameters: currentParameters, data: previousData };
    });

    const { result } = renderHook(() => useParamsOverride(selectedTrial));

    await act(async () => {
      await result.current.loadTrialDataFields(4);
      await result.current.loadTrialDataFields(5);
      await result.current.loadTrialDataFields(6);
    });

    expect(console.log).toHaveBeenCalledWith(
      "Trial not found or has no plugin:",
      4,
    );
    expect(console.log).toHaveBeenCalledWith(
      "Trial not found or has no plugin:",
      5,
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error loading trial data fields:",
      expect.any(Error),
    );
    expect(result.current.loadingData[6]).toBe(false);
  });

  it("returns main timeline trials and excludes string-matched used ids", async () => {
    const paramsOverride: ParamsOverrideCondition[] = [
      {
        id: 7,
        rules: [{ trialId: "1", column: "response", op: "==", value: "yes" }],
        paramsToOverride: {},
      },
    ];
    const selectedTrial = {
      id: 3,
      name: "Current",
      plugin: "plugin-current",
      paramsOverride,
    };

    const { result, rerender } = renderHook(
      ({ trial }) => useParamsOverride(trial),
      { initialProps: { trial: selectedTrial as any } },
    );

    await waitFor(() => {
      expect(result.current.conditions).toEqual(paramsOverride);
    });

    expect(result.current.getAvailableTrials()).toEqual([
      { id: 1, name: "Intro" },
      { id: 2, name: "Prime" },
    ]);
    expect(result.current.getAvailableTrialsForCondition(7)).toEqual([
      { id: 2, name: "Prime" },
    ]);
    expect(result.current.getCurrentTrialCsvColumns()).toEqual([]);

    rerender({
      trial: {
        id: 99,
        name: "Missing Main",
        plugin: "plugin-current",
        paramsOverride: [],
      } as any,
    });
    expect(result.current.getAvailableTrials()).toEqual([]);

    rerender({
      trial: {
        id: 99,
        name: "Missing Loop",
        plugin: "plugin-current",
        parentLoopId: "loop_1",
        paramsOverride: [],
      } as any,
    });
    expect(result.current.getAvailableTrials()).toEqual([]);
  });

  it("covers cached data loads, string id matching and triggerSave defaults", async () => {
    const paramsOverride: ParamsOverrideCondition[] = [
      {
        id: 8,
        rules: [{ column: "response", op: "==", value: "yes" } as any],
        paramsToOverride: {},
      },
    ];
    const selectedTrial = {
      id: "3",
      name: "Current String Id",
      plugin: "plugin-current",
      paramsOverride,
    };

    const { result } = renderHook(() => useParamsOverride(selectedTrial));

    await waitFor(() => {
      expect(result.current.conditions).toEqual(paramsOverride);
    });

    expect(result.current.getAvailableTrials()).toEqual([
      { id: 1, name: "Intro" },
      { id: 2, name: "Prime" },
    ]);

    await act(async () => {
      await result.current.loadTrialDataFields(2);
    });
    expect(mocks.trialsContext.getTrial).toHaveBeenCalledWith(2);

    await act(async () => {
      await result.current.loadTrialDataFields(2);
    });
    expect(mocks.trialsContext.getTrial).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.triggerSave();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith("3", {
      paramsOverride,
    });
  });

  it("handles ParamsOverride saves with null updates and thrown errors", async () => {
    vi.useFakeTimers();
    const selectedTrial = {
      id: 3,
      name: "Current",
      plugin: "plugin-current",
      paramsOverride: [],
    };
    const updateTrial = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("save failed"));
    installTrialsContext({ updateTrial });

    const { result } = renderHook(() => useParamsOverride(selectedTrial));

    await act(async () => {
      await result.current.handleSaveConditions([]);
    });

    expect(mocks.trialsContext.setSelectedTrial).not.toHaveBeenCalled();
    expect(result.current.saveIndicator).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.saveIndicator).toBe(false);

    await act(async () => {
      await result.current.handleSaveConditions([]);
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error saving params override conditions:",
      expect.any(Error),
    );
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

  it("covers ConditionalLoop guards, cached lookups and explicit saves", async () => {
    const getTrial = vi.fn(async (id: string | number) => {
      if (id === 404) return null;
      if (id === 405) throw new Error("lookup failed");
      if (id === 406) return { id, name: "No Plugin" };
      if (id === 407) return { id, name: "Broken Metadata", plugin: "plugin-broken" };
      return {
        id,
        name: `Trial ${id}`,
        plugin: "plugin-previous",
      };
    });
    installTrialsContext({ getTrial });
    mocks.loadPluginParameters.mockImplementation(async (pluginName: string) => {
      if (pluginName === "plugin-broken") {
        throw new Error("metadata failed");
      }
      return { parameters: currentParameters, data: previousData };
    });
    const loop = {
      id: "loop_1",
      name: "Parent Loop",
    } as Loop;
    const onSave = vi.fn();

    const { result } = renderHook(() => useConditionalLoop(loop, onSave));

    await waitFor(() => {
      expect(result.current.conditions).toEqual([]);
    });

    await act(async () => {
      await result.current.loadTrialDataFields(4);
    });
    await waitFor(() => {
      expect(result.current.trialDataFields[4]).toEqual(previousData);
    });

    expect(result.current.findTrialByIdSync(null)).toBeNull();
    expect(result.current.findTrialByIdSync(4)).toEqual(
      expect.objectContaining({ id: 4, plugin: "plugin-previous" }),
    );
    expect(result.current.findTrialByIdSync(999)).toBeNull();
    expect(result.current.getAvailableTrials(999)).toEqual([
      { id: 1, name: "Loop Intro" },
      { id: 2, name: "Loop Prime" },
      { id: 3, name: "Loop Current" },
      { id: "loop_2", name: "Nested Loop" },
    ]);

    await act(async () => {
      await result.current.loadTrialDataFields(4);
    });
    expect(getTrial).toHaveBeenCalledWith(4);
    expect(getTrial.mock.calls.filter(([id]) => id === 4)).toHaveLength(1);

    await expect(result.current.loadTrialOrLoop(4)).resolves.toEqual(
      expect.objectContaining({ id: 4, plugin: "plugin-previous" }),
    );
    await expect(result.current.loadTrialOrLoop(404)).resolves.toBeNull();
    await expect(result.current.loadTrialOrLoop(405)).resolves.toBeNull();

    await act(async () => {
      await result.current.loadTrialDataFields(406);
      await result.current.loadTrialDataFields(407);
    });

    expect(console.log).toHaveBeenCalledWith(
      "Trial/Loop not found:",
      404,
    );
    expect(console.log).toHaveBeenCalledWith(
      "Trial not found or has no plugin:",
      406,
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error loading trial/loop:",
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error loading trial data fields:",
      expect.any(Error),
    );

    act(() => {
      result.current.triggerSave();
      result.current.setConditionsWrapper([], false);
    });

    expect(onSave).toHaveBeenCalledWith([]);
  });

  it("handles a ConditionalLoop without an id, target or active timeline", async () => {
    const loopCondition: LoopCondition = {
      id: 9,
      rules: [{ column: "response", op: "==", value: "yes" } as any],
    };
    const loop = {
      id: "",
      name: "Detached Loop",
      loopConditions: [loopCondition],
    } as Loop;

    const { result } = renderHook(() => useConditionalLoop(loop, vi.fn()));

    await waitFor(() => {
      expect(result.current.conditions).toEqual([loopCondition]);
    });

    expect(mocks.trialsContext.getLoopTimeline).not.toHaveBeenCalled();
    expect(result.current.getAvailableTrials(9)).toEqual([]);
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
