import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  installTrialsContext,
  mocks,
  useParamsOverrideHarness,
} from "./testHarness";
import type { ParamsOverrideCondition } from "./testHarness";

const useParamsOverride = useParamsOverrideHarness;

describe("condition hooks: ParamsOverride availability and persistence", () => {
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
});
