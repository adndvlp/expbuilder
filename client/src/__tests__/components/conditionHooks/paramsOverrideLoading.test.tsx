import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  currentParameters,
  installTrialsContext,
  mocks,
  previousData,
  useParamsOverrideHarness,
} from "./testHarness";
import type { ParamsOverrideCondition } from "./testHarness";

const useParamsOverride = useParamsOverrideHarness;

describe("condition hooks: ParamsOverride loading and lookup guards", () => {
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
    expect(result.current.getCurrentTrialCsvColumns()).toEqual([
      "stimulus_col",
    ]);
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
    mocks.loadPluginParameters.mockImplementation(
      async (pluginName: string) => {
        if (pluginName === "plugin-broken") {
          throw new Error("trial metadata failed");
        }
        return { parameters: currentParameters, data: previousData };
      },
    );

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
});
